import type { Logger } from './output.js';

import { readdir, readFile } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { transform } from 'rolldown/experimental';

import { API_VERSION } from '../api-version.js';
import { SERVER_FILE } from '../bundle.js';
import { unknownCategoryIssues } from '../categories.js';
import {
	GENERATED_MANIFEST_KEYS,
	MANIFEST_FILE,
	UI_DIR,
	authProviderContributionSchema,
	collectionContributionSchema,
	fieldContributionSchema,
	pageContributionSchema,
	parseManifest,
	pluginSettingsSchema,
	withPackageDefaults,
	type AuthProviderContribution,
	type CollectionContribution,
	type FieldContribution,
	type ManifestIssue,
	type PageContribution,
	type PluginManifest,
	type PluginSetting
} from '../manifest.js';
import { pluginFilePath } from '../server.js';
import { svgIconIssues } from '../svg.js';
import { isHostModuleId } from '../ui.js';
import { DYNAMIC_IMPORT_HINT, HOST_MODULES_HINT } from './components.js';
import { count, kib } from './format.js';
import { iconifyBundlePath, isIconifyName, resolveIconifyIcon } from './icons.js';
import {
	HOST_MODULES_SUMMARY,
	IMPORT,
	isDynamicImport,
	isObject,
	loadPackageJson,
	missingProviderMembers
} from './project.js';
import { ProjectError } from './project-error.js';
import {
	ROUTE_METHODS,
	bundleServerCode,
	generateServerEntry,
	importServerCode
} from './server-entry.js';
import { title } from './templates.js';

/**
 * Finding what a plugin project contributes. `plugin.ts` says it all: its default export is
 * `definePlugin({ settings, fields, pages, authProviders, collections, routes })`, and it imports the code,
 * components and icons of each from wherever the plugin keeps them.
 *
 * ```ts
 * import { definePlugin } from '@pouchbasejs/plugin-sdk/server';
 *
 * import rating from './fields/rating/field.js';
 * import Stats from './pages/stats.svelte';
 * import * as items from './routes/items.js';
 *
 * export default definePlugin({
 * 	fields: { rating },
 * 	pages: { stats: { title: 'Stats', icon: 'lucide:chart-bar', component: Stats } },
 * 	routes: { '/items/:id': items }
 * });
 * ```
 *
 * The CLI bundles `plugin.ts` and runs it in Node.js, where every imported `.svelte` and `.svg`
 * file is a `PluginFile` (see `vite.ts`): the components and icons it names become UI files
 * of the bundle, with every project file they import, at `ui/<their path>`. An icon is an Iconify
 * name (`lucide:palette`), which becomes `ui/icons/<prefix>/<name>.svg` in the bundle (see
 * `icons.ts`), or an imported `.svg` file. `pouchbase-plugin.json` keeps what isn't code: `id`,
 * `name`, `permissions`, `icon`, `categories`, `engines`, ...; the plugin's icon is `icon.svg`
 * unless the manifest names another.
 */

/** Folders never read, wherever they are. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage']);

/** The plugin's definition, at the root of the project. */
export const PLUGIN_FILES = ['plugin.ts', 'plugin.js'] as const;

/** What `definePlugin({ ... })` can have. */
const DEFINITION_KEYS = [
	'settings',
	'fields',
	'pages',
	'authProviders',
	'collections',
	'routes'
] as const;

/**
 * Files a UI file may import, by their extension in the project: the host compiles `.svelte` and
 * links `.js` (TypeScript becomes `.js`), and refuses to import anything else.
 */
const UI_MODULE = /\.(?:svelte|ts|js)$/;

/** Why a UI file can't import a file of another kind, and what to do instead. */
const UI_IMPORT_HINTS: Record<string, string> = {
	'.css':
		'Pouchbase loads no stylesheets from imports: put the styles in a <style> block of the component, where they are scoped to it.',
	'.json':
		'Pouchbase only links JavaScript: inline the data in a .ts module, e.g. export const data = { ... };',
	'.svg': 'Pouchbase only links JavaScript: inline the SVG markup in a component.'
};

/** The module of the server code's helpers; a file that imports it is server code. */
const SERVER_MODULE = '@pouchbasejs/plugin-sdk/server';

/** `items`, `v2`, `status.json`: a static route segment. */
const ROUTE_SEGMENT = /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/;

/** `:id`: a route param. */
const ROUTE_PARAM = /^:[A-Za-z_][A-Za-z0-9_]*$/;

/** First segments of a route path that the host serves itself. */
const RESERVED_ROUTE_SEGMENTS = ['assets', 'modules'];

/** What a project contributes, by id, for messages and the CLI's summary. */
export type ProjectContents = {
	fields: string[];
	pages: string[];
	authProviders: string[];
	/** Names of the plugin's collections, without the prefix. */
	collections: string[];
	/** Route keys, e.g. `GET /items/:id`. */
	routes: string[];
	settings: string[];
};

export type DiscoveredProject = {
	/**
	 * The manifest as a bundle has it: validated, with defaults and the fields from `package.json`
	 * filled in, `server` set to `server.js` when there is server code and every path a bundle path.
	 */
	manifest: PluginManifest;
	/** Bundle path (`ui/fields/rating/input.svelte`) → contents; TypeScript is turned into `.js`. */
	uiFiles: Record<string, string>;
	/**
	 * Bundle path → the file in the project it comes from (`fields/rating/input.svelte`); icons
	 * given by Iconify name come from no file, so they aren't listed.
	 */
	uiSources: Record<string, string>;
	/**
	 * Source of the server entry module, or `null` without server code: generated from `plugin.ts`
	 * (see `generateServerEntry`). It imports project files by their absolute path, so a bundler can
	 * serve it as a virtual module.
	 */
	serverEntry: string | null;
	/** `serverEntry` bundled into one module without imports, as `server.js` of the bundle. */
	serverCode: string | null;
	/** Route keys of the server code, sorted as found. */
	routes: string[];
	found: ProjectContents;
	/** Problems that don't stop a build. */
	warnings: ManifestIssue[];
};

export type DiscoverOptions = {
	/** Reports every step, like the other commands. */
	log?: Logger;
};

/** A problem with the plugin: where, what, and how to fix it. */
type Problem = { path: string; message: string; hint?: string };

function fail(problems: Problem[], summary = 'The plugin has problems'): never {
	const hints = [...new Set(problems.flatMap((problem) => problem.hint ?? []))];
	const [first] = problems;

	if (problems.length === 1 && first) {
		throw new ProjectError(`${first.path}: ${first.message}`, [], hints[0]);
	}

	throw new ProjectError(
		summary,
		problems.map(({ path, message }) => ({ path, message })),
		hints.join(' ') || undefined
	);
}

/** Every file of the project as a POSIX path, without `node_modules`, `dist` and dot folders. */
async function projectFiles(root: string): Promise<string[]> {
	const files: string[] = [];

	async function walk(dir: string, prefix: string) {
		const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => []);

		for (const entry of entries) {
			const path = prefix + entry.name;

			if (entry.isDirectory()) {
				if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
					await walk(path, `${path}/`);
				}
			} else if (entry.isFile()) {
				files.push(path);
			}
		}
	}

	await walk('', '');

	return files.sort();
}

/** The parsed `pouchbase-plugin.json`, as written. */
async function readManifestJson(root: string): Promise<Record<string, unknown>> {
	let json: unknown;

	try {
		json = JSON.parse(await readFile(join(root, MANIFEST_FILE), 'utf8'));
	} catch (error) {
		throw new ProjectError(
			`Can't read ${MANIFEST_FILE}: ${(error as Error).message}`,
			[],
			(error as NodeJS.ErrnoException).code === 'ENOENT'
				? 'Run the command in the folder of a plugin, or create one with pouchbase-plugin init.'
				: undefined
		);
	}

	if (!isObject(json)) {
		throw new ProjectError(`${MANIFEST_FILE} must be a JSON object`);
	}

	return json;
}

/** `2 field types (color, rating)`; `null` for none. */
function listed(ids: readonly string[], singular: string, plural?: string) {
	return ids.length ? `${count(ids.length, singular, plural)} (${ids.join(', ')})` : null;
}

/** `Found 1 field type (rating), 1 page (overview), 3 routes (GET /info, …), 2 settings`. */
export function describeContents(found: ProjectContents): string {
	const parts = [
		listed(found.fields, 'field type'),
		listed(found.pages, 'page'),
		listed(found.authProviders, 'auth provider'),
		listed(found.collections, 'collection'),
		listed(found.routes, 'route'),
		listed(found.settings, 'setting')
	].filter((part) => part !== null);

	return parts.length ? `Found ${parts.join(', ')}` : 'Found nothing to contribute yet';
}

/**
 * Finds what the plugin in `root` contributes and builds its manifest, UI files and server code:
 * from `plugin.ts` and `pouchbase-plugin.json`. Throws a `ProjectError` for every problem, with
 * the file it concerns and a hint.
 */
export async function discoverProject(
	directory: string,
	{ log }: DiscoverOptions = {}
): Promise<DiscoveredProject> {
	// Absolute, so the generated server entry imports absolute paths.
	const root = resolve(directory);

	log?.step(`Reading ${MANIFEST_FILE}`);

	const json = await readManifestJson(root);
	const files = await projectFiles(root);

	return discoverDefinition(root, json, files, log);
}

// Ids and paths

/** Why `name` can't be an id, when it has capitals: the most common mistake. */
function lowercaseHint(name: string) {
	return /[A-Z]/.test(name) ? 'use lowercase names' : null;
}

/**
 * Why `path` can't be the path of a route (a key of `routes`, e.g. `/items/:id`), or `null` when it
 * can.
 */
export function routePathProblem(path: string): string | null {
	if (!path.startsWith('/')) {
		return `starts with a slash, e.g. /${path}`;
	}

	if (path === '/') {
		return null;
	}

	const segments = path.slice(1).split('/');

	for (const segment of segments) {
		if (!segment) {
			return 'has an empty segment; remove the extra or trailing slash';
		}

		if (/^\[.+\]$/.test(segment)) {
			return `"${segment}" is written :${segment.slice(1, -1)} for a parameter`;
		}

		if (!ROUTE_PARAM.test(segment) && !ROUTE_SEGMENT.test(segment)) {
			return (
				lowercaseHint(segment) ??
				`"${segment}" can't be part of a route path; use lowercase words separated by dashes, or :name for a parameter`
			);
		}
	}

	if (segments[0] && RESERVED_ROUTE_SEGMENTS.includes(segments[0])) {
		return `/${segments[0]} is served by Pouchbase itself (${RESERVED_ROUTE_SEGMENTS.map((segment) => `/${segment}`).join(', ')}); use another path`;
	}

	return null;
}

/** `items/[id]`, `/items/:id` → `/items/:id`: the route path `add route` takes. */
export function routePathFor(id: string): string {
	const segments = id
		.trim()
		.split('/')
		.filter(Boolean)
		.map((segment) => segment.replace(/^\[(.+)\]$/, ':$1'));

	return `/${segments.join('/')}`;
}

/**
 * The file `add route` creates for a route path: `/` → `routes/index.ts`, `/items/:id` →
 * `routes/items/[id].ts`; `null` when the path can't be a route.
 */
export function routeFileFor(path: string): string | null {
	const route = routePathFor(path);

	if (routePathProblem(route) !== null) {
		return null;
	}

	const segments = route
		.split('/')
		.filter(Boolean)
		.map((segment) => (segment.startsWith(':') ? `[${segment.slice(1)}]` : segment));

	return `routes/${segments.length ? segments.join('/') : 'index'}.ts`;
}

// UI files

/** The bundle path of a UI file of the project: `lib/stars.ts` → `ui/lib/stars.js`. */
export function uiBundlePath(path: string) {
	return `${UI_DIR}/${path.replace(/\.ts$/, '.js')}`;
}

/**
 * The UI files of the bundle: `entries` (components and images) and every project file they
 * import, each under `ui/` at its project path. `serverFiles` can't be imported.
 */
async function collectUiFiles(
	root: string,
	entries: readonly string[],
	all: Set<string>,
	serverFiles: ReadonlySet<string>
) {
	const uiFiles: Record<string, string> = {};
	const uiSources: Record<string, string> = {};
	const problems: Problem[] = [];
	const queue = [...entries];
	const seen = new Set<string>();
	/** The file that first imported each file, for messages. */
	const importers = new Map<string, string>();
	let compiled = 0;

	while (queue.length) {
		const path = queue.shift()!;

		if (seen.has(path)) {
			continue;
		}

		seen.add(path);

		let source = await readFile(join(root, path), 'utf8');

		if (path.endsWith('.ts')) {
			const result = await transform(path, source, { lang: 'ts' });

			if (result.errors.length) {
				problems.push(...result.errors.map((error) => ({ path, message: error.message })));
				continue;
			}

			source = result.code;
			compiled += 1;
		}

		if (/\.(?:svelte|ts|js)$/.test(path)) {
			for (const match of source.matchAll(IMPORT)) {
				const specifier = match[1] ?? match[2] ?? '';

				if (isDynamicImport(match[0])) {
					problems.push({
						path,
						message: `imports ${specifier} with import(); UI files may only use static imports`,
						hint: DYNAMIC_IMPORT_HINT
					});
					continue;
				}

				if (specifier === SERVER_MODULE) {
					const importer = importers.get(path);

					problems.push(
						importer
							? {
									path: importer,
									message: `imports ${path}, which is server code (it imports ${SERVER_MODULE}); move what both need into a shared file, e.g. lib/`
								}
							: { path, message: `imports ${SERVER_MODULE}, which only server code can import` }
					);
					continue;
				}

				if (!specifier.startsWith('.')) {
					if (!isHostModuleId(specifier)) {
						problems.push({
							path,
							message: `imports ${specifier}, which Pouchbase doesn't provide; UI files may only import ${HOST_MODULES_SUMMARY} and other files of the plugin`,
							hint: `${HOST_MODULES_HINT} Other packages and server code are not available in the browser.`
						});
					}

					continue;
				}

				const target = posix.normalize(posix.join(posix.dirname(path), specifier));
				const resolved = all.has(target)
					? target
					: target.endsWith('.js') && all.has(target.replace(/\.js$/, '.ts'))
						? target.replace(/\.js$/, '.ts')
						: null;

				if (target.startsWith('../')) {
					problems.push({ path, message: `imports ${specifier}, which is outside the plugin` });
				} else if (specifier.endsWith('.ts')) {
					problems.push({
						path,
						message: `imports ${specifier}; import TypeScript modules by their .js name (${specifier.replace(/\.ts$/, '.js')}), as they are in the bundle`
					});
				} else if (!resolved) {
					problems.push({
						path,
						message: `imports ${specifier}, which doesn't exist (write the file extension, e.g. ./stars.js)`
					});
				} else if (serverFiles.has(resolved)) {
					problems.push({
						path,
						message: `imports ${resolved}, which is server code; move what both need into a shared file, e.g. lib/`
					});
				} else if (!UI_MODULE.test(resolved)) {
					const extension = posix.extname(resolved);

					problems.push({
						path,
						message: `imports ${specifier}; UI files may only import .svelte, .ts and .js files`,
						hint:
							UI_IMPORT_HINTS[extension] ??
							'Pouchbase only links .svelte and .js files of the plugin.'
					});
				} else {
					if (!importers.has(resolved)) {
						importers.set(resolved, path);
					}

					queue.push(resolved);
				}
			}
		}

		uiFiles[uiBundlePath(path)] = source;
		uiSources[uiBundlePath(path)] = path;
	}

	if (problems.length) {
		fail(problems, 'Problems in the UI files');
	}

	return { uiFiles, uiSources, compiled };
}

// plugin.ts

/** `definePlugin({ ... })` as `plugin.ts` default-exports it, after the bundle ran in Node.js. */
async function loadDefinition(root: string, file: string): Promise<Record<string, unknown>> {
	const code = await bundleServerCode(root, { file });
	let definition: unknown;

	try {
		definition = await importServerCode(code);
	} catch (error) {
		throw new ProjectError(
			`Can't load ${file}: ${(error as Error).message}`,
			[],
			`The CLI runs ${file} in Node.js to read the plugin; keep the top level of ${file} and the files it imports free of APIs that only the sandbox has.`
		);
	}

	if (!isObject(definition)) {
		fail([
			{
				path: file,
				message: 'must default-export definePlugin({ ... })',
				hint: "import { definePlugin } from '@pouchbasejs/plugin-sdk/server'; export default definePlugin({ settings: [], fields: {}, pages: {}, routes: {} });"
			}
		]);
	}

	return definition;
}

/** The definition's `key` as a record by id; a problem when it's something else. */
function recordOf(
	definition: Record<string, unknown>,
	key: (typeof DEFINITION_KEYS)[number],
	file: string,
	problems: Problem[]
): [string, unknown][] {
	const value = definition[key];

	if (value === undefined) {
		return [];
	}

	if (!isObject(value) || Array.isArray(value)) {
		problems.push({
			path: file,
			message: `${key} must be an object by id, e.g. ${key}: { ${key === 'routes' ? "'/items': items" : 'rating'} }`
		});

		return [];
	}

	return Object.entries(value);
}

/** `fields.rating`, `routes['/items/:id']`: where a value is in the definition, for messages. */
function at(key: string, id: string) {
	return /^[A-Za-z_$][\w$]*$/.test(id) ? `${key}.${id}` : `${key}[${JSON.stringify(id)}]`;
}

/** A component that `plugin.ts` names: its path, and where in the definition it is. */
type FileUse = { path: string; where: string };

/** Reading `plugin.ts`: what the plugin adds, from `definePlugin({ ... })`. */
async function discoverDefinition(
	root: string,
	json: Record<string, unknown>,
	files: string[],
	log?: Logger
): Promise<DiscoveredProject> {
	const all = new Set(files);
	const problems: Problem[] = [];
	const warnings: ManifestIssue[] = [];

	log?.detail(typeof json.id === 'string' ? json.id : 'The plugin');

	// Settings are code, so they are typed.
	if (json.settings !== undefined) {
		problems.push({
			path: MANIFEST_FILE,
			message: '"settings" belong in definePlugin({ settings }) in plugin.ts',
			hint: 'Move the settings to definePlugin({ settings }) in plugin.ts and remove "settings" from pouchbase-plugin.json; pouchbase-plugin add setting <key> adds one.'
		});
	}

	for (const key of GENERATED_MANIFEST_KEYS.filter(
		(key) => key !== 'settings' && json[key] !== undefined
	)) {
		problems.push({
			path: MANIFEST_FILE,
			message: `"${key}" is generated from plugin.ts`,
			hint: 'Move the contributions and server code into definePlugin({ ... }) in plugin.ts and remove "contributes" and "server" from pouchbase-plugin.json.'
		});
	}

	const pluginFiles = PLUGIN_FILES.filter((file) => all.has(file));

	if (pluginFiles.length > 1) {
		problems.push({
			path: pluginFiles.join(', '),
			message: 'the plugin has both; keep one of them'
		});
	}

	const pluginFile = pluginFiles[0];

	if (!pluginFile) {
		problems.push({
			path: PLUGIN_FILES[0],
			message: "doesn't exist; it default-exports definePlugin({ ... }) with what the plugin adds",
			hint: "import { definePlugin } from '@pouchbasejs/plugin-sdk/server'; export default definePlugin({});"
		});
	}

	// The plugin's icon: `icon` in the manifest (a project path), else `icon.svg`.
	const iconFile =
		typeof json.icon === 'string' ? json.icon : all.has('icon.svg') ? 'icon.svg' : null;

	if (iconFile !== null && (!iconFile.endsWith('.svg') || !all.has(iconFile))) {
		problems.push({
			path: MANIFEST_FILE,
			message: `icon: ${iconFile} ${iconFile.endsWith('.svg') ? "doesn't exist" : 'must be an .svg file'}`
		});
	}

	if (problems.length || !pluginFile) {
		fail(problems);
	}

	const file: string = pluginFile;

	log?.step(`Reading ${file}`);

	const definition = await loadDefinition(root, file);

	for (const key of Object.keys(definition)) {
		if (!(DEFINITION_KEYS as readonly string[]).includes(key)) {
			problems.push({
				path: file,
				message: `definePlugin({ ${key} }) isn't something a plugin adds; use ${DEFINITION_KEYS.join(', ')}`
			});
		}
	}

	// Settings
	const settingsResult = pluginSettingsSchema.safeParse(definition.settings ?? []);
	let settings: PluginSetting[] = [];

	if (settingsResult.success) {
		settings = settingsResult.data;
	} else {
		problems.push(
			...settingsResult.error.issues.map((issue) => ({
				path: file,
				message: `${['settings', ...issue.path].join('.')}: ${issue.message}`
			}))
		);
	}

	// Icons: an Iconify name becomes a file of the bundle, an imported .svg file is a UI file like
	// the components. Both are checked like a host checks them; logos keep their colors.
	const iconifyIcons: Record<string, string> = {};
	const iconFiles: string[] = [];

	/** An icon from a project file, checked; its bundle path, or `undefined` after a problem. */
	async function fileIcon(path: string, where: string, logo: boolean): Promise<string | undefined> {
		if (!logo) {
			const issues = svgIconIssues(await readFile(join(root, path), 'utf8'));

			if (issues.length) {
				problems.push(
					...issues.map((message) => ({
						path,
						message: `${message} (${where})`,
						hint: 'Icons are plain SVG images, drawn in one color by Pouchbase; an Iconify name (e.g. lucide:palette) gives one.'
					}))
				);

				return undefined;
			}
		}

		iconFiles.push(path);

		return uiBundlePath(path);
	}

	/**
	 * The bundle path of `value`, the icon at `where`: an Iconify name or an imported `.svg` file;
	 * `undefined` for none or after a problem. A `logo` keeps its colors.
	 */
	async function contributionIcon(
		value: unknown,
		where: string,
		logo = false
	): Promise<string | undefined> {
		if (value === undefined) {
			return undefined;
		}

		const path = pluginFilePath(value);

		if (path !== null) {
			if (!path.endsWith('.svg')) {
				problems.push({ path: file, message: `${where}: ${path} is not an .svg file` });

				return undefined;
			}

			return fileIcon(path, where, logo);
		}

		if (typeof value !== 'string' || !isIconifyName(value)) {
			problems.push({
				path: file,
				message: `${where} must be an Iconify name, e.g. lucide:palette, or an imported .svg file`,
				hint: "Import an icon of the plugin like a module: import icon from './icon.svg';"
			});

			return undefined;
		}

		try {
			const { svg, source } = await resolveIconifyIcon(root, value, { log, label: where });
			const bundlePath = iconifyBundlePath(value);

			iconifyIcons[bundlePath] = svg;
			log?.detail(`Resolved icon ${value} for ${where} (${source})`);

			return bundlePath;
		} catch (error) {
			if (!(error instanceof ProjectError)) {
				throw error;
			}

			problems.push({ path: file, message: `${where}: ${error.message}`, hint: error.hint });

			return undefined;
		}
	}

	/** The component at `where`, an imported `.svelte` file; `null` after a problem. */
	function component(value: unknown, where: string, example: string): FileUse | null {
		const path = pluginFilePath(value);

		if (path === null || !path.endsWith('.svelte')) {
			problems.push({
				path: file,
				message:
					value === undefined
						? `${where} is missing: a Svelte component of the plugin, e.g. ${example}`
						: `${where} must be a Svelte component of the plugin, imported like a module: ${example}`
			});

			return null;
		}

		return { path, where };
	}

	const components: FileUse[] = [];

	// Field types: `fields: { rating }`.
	const fieldContributions: FieldContribution[] = [];

	for (const [type, field] of recordOf(definition, 'fields', file, problems)) {
		const where = at('fields', type);

		if (!fieldContributionSchema.shape.type.safeParse(type).success) {
			problems.push({
				path: file,
				message: `${where}: ${lowercaseHint(type) ?? `"${type}" can't be a field type; use lowercase letters, numbers and underscores, e.g. rating`}`
			});
			continue;
		}

		if (!isObject(field)) {
			problems.push({ path: file, message: `${where} must be defineField({ ... })` });
			continue;
		}

		const input = component(field.input, `${where}.input`, "import Input from './input.svelte'");
		const preview =
			field.preview === undefined
				? null
				: component(field.preview, `${where}.preview`, "import Preview from './preview.svelte'");
		const icon = await contributionIcon(field.icon, `${where}.icon`);

		if (!input || (field.preview !== undefined && !preview)) {
			continue;
		}

		components.push(input, ...(preview ? [preview] : []));

		const result = fieldContributionSchema.safeParse({
			type,
			label: field.label ?? title(type),
			description: field.description,
			column: field.column,
			input: uiBundlePath(input.path),
			...(preview ? { preview: uiBundlePath(preview.path) } : {}),
			...(icon ? { icon } : {})
		});

		if (!result.success) {
			for (const issue of result.error.issues) {
				const key = issue.path.join('.');

				problems.push({
					path: file,
					message:
						key === 'description' && field.description === undefined
							? `${where} needs a description: one sentence shown when an admin picks the type`
							: key === 'column' && field.column === undefined
								? `${where} needs a column: TEXT, INTEGER, REAL or BLOB, the storage class of the value`
								: `${where}.${key}: ${issue.message}`
				});
			}

			continue;
		}

		fieldContributions.push(result.data);
	}

	// Pages: `pages: { stats: { title, icon, component } }`, in this order.
	const pageContributions: PageContribution[] = [];

	for (const [path, page] of recordOf(definition, 'pages', file, problems)) {
		const where = at('pages', path);

		if (!pageContributionSchema.shape.path.safeParse(path).success) {
			problems.push({
				path: file,
				message: `${where}: ${lowercaseHint(path) ?? `"${path}" can't be a page path; use lowercase words separated by dashes, with slashes between segments, e.g. reports/monthly`}`
			});
			continue;
		}

		if (!isObject(page)) {
			problems.push({
				path: file,
				message: `${where} must be a page, e.g. { title: 'Stats', component: Stats }`
			});
			continue;
		}

		const use = component(
			page.component,
			`${where}.component`,
			"import Stats from './stats.svelte'"
		);
		const icon = await contributionIcon(page.icon, `${where}.icon`);

		if (!use) {
			continue;
		}

		components.push(use);

		const result = pageContributionSchema.safeParse({
			path,
			title: page.title ?? title(path),
			component: uiBundlePath(use.path),
			...(page.navigation !== undefined ? { navigation: page.navigation } : {}),
			...(icon ? { icon } : {})
		});

		if (!result.success) {
			problems.push(
				...result.error.issues.map((issue) => ({
					path: file,
					message: `${where}.${issue.path.join('.')}: ${issue.message}`
				}))
			);
			continue;
		}

		pageContributions.push(result.data);
	}

	// Auth providers: `authProviders: { gitlab }`.
	const providerContributions: AuthProviderContribution[] = [];

	for (const [id, provider] of recordOf(definition, 'authProviders', file, problems)) {
		const where = at('authProviders', id);
		const idResult = authProviderContributionSchema.shape.id.safeParse(id);

		if (!idResult.success) {
			problems.push({
				path: file,
				message: `${where}: ${lowercaseHint(id) ?? `"${id}" can't be a provider id: ${idResult.error.issues[0]?.message ?? 'invalid'}`}`
			});
			continue;
		}

		if (!isObject(provider)) {
			problems.push({ path: file, message: `${where} must be defineAuthProvider({ ... })` });
			continue;
		}

		const missing = missingProviderMembers(provider);

		if (missing.length) {
			problems.push({ path: file, message: `${where} lacks ${missing.join(', ')}` });
			continue;
		}

		const icon = await contributionIcon(provider.icon, `${where}.icon`, true);
		const result = authProviderContributionSchema.safeParse({
			id,
			label: provider.label ?? title(id),
			...(provider.consoleUrl !== undefined ? { consoleUrl: provider.consoleUrl } : {}),
			...(icon ? { icon } : {})
		});

		if (!result.success) {
			problems.push(
				...result.error.issues.map((issue) => ({
					path: file,
					message: `${where}.${issue.path.join('.')}: ${issue.message}`
				}))
			);
			continue;
		}

		providerContributions.push(result.data);
	}

	// Collections: `collections: { reviews: { fields: [...] } }`.
	const collectionContributions: CollectionContribution[] = [];

	for (const [name, collection] of recordOf(definition, 'collections', file, problems)) {
		const where = at('collections', name);

		if (!isObject(collection)) {
			problems.push({
				path: file,
				message: `${where} must be defineCollection({ fields: [...] })`
			});
			continue;
		}

		const result = collectionContributionSchema.safeParse({ ...collection, name });

		if (!result.success) {
			problems.push(
				...result.error.issues.map((issue) => ({
					path: file,
					message:
						issue.path[0] === 'name'
							? `${where}: ${lowercaseHint(name) ?? `"${name}" can't be a collection name; ${issue.message.toLowerCase()}, e.g. reviews`}`
							: `${where}.${issue.path.join('.')}: ${issue.message}`
				}))
			);
			continue;
		}

		collectionContributions.push(result.data);
	}

	// Routes: `routes: { '/items/:id': items }`, a handler per method.
	const routes: string[] = [];
	const shapes = new Map<string, string>();

	for (const [path, module] of recordOf(definition, 'routes', file, problems)) {
		const where = at('routes', path);
		const problem = routePathProblem(path);

		if (problem !== null) {
			problems.push({ path: file, message: `${where}: ${problem}` });
			continue;
		}

		// `/items/:id` and `/items/:slug` answer the same requests.
		const shape = path.replace(/:[^/]+/g, ':');
		const other = shapes.get(shape);

		if (other !== undefined) {
			problems.push({
				path: file,
				message: `${where} answers the same paths as ${at('routes', other)}; keep one of them`
			});
			continue;
		}

		shapes.set(shape, path);

		const methods = isObject(module)
			? ROUTE_METHODS.filter((method) => typeof module[method] === 'function')
			: [];

		if (!methods.length) {
			problems.push({
				path: file,
				message: `${where} has no ${ROUTE_METHODS.join(', ')} handler`,
				hint: "A route is a handler per method: import * as items from './routes/items.js' for a module with export const GET: RouteHandler = ..., or { GET: (request, ctx) => Response.json({ ok: true }) }."
			});
			continue;
		}

		routes.push(...methods.map((method) => `${method} ${path}`));
	}

	if (problems.length) {
		fail(problems, `Problems in ${file}`);
	}

	const contents = [
		fieldContributions.length && count(fieldContributions.length, 'field type'),
		pageContributions.length && count(pageContributions.length, 'page'),
		providerContributions.length && count(providerContributions.length, 'auth provider'),
		collectionContributions.length && count(collectionContributions.length, 'collection'),
		routes.length && count(routes.length, 'route'),
		settings.length && count(settings.length, 'setting')
	].filter(Boolean);

	log?.detail(contents.length ? contents.join(', ') : 'Nothing to contribute yet');

	// Server code: the generated entry turns the definition into what the host runs.
	const hasServer = fieldContributions.length + providerContributions.length + routes.length > 0;
	const serverEntry = hasServer ? generateServerEntry({ plugin: file }, { root }) : null;
	let serverCode: string | null = null;

	if (serverEntry !== null) {
		log?.step('Bundling the server code');

		serverCode = await bundleServerCode(root, { source: serverEntry }, 'the server code');

		log?.detail(`${kib(Buffer.byteLength(serverCode))} of server code, in one module`);
	}

	log?.step('Checking the UI files');

	// Components and code they import can't be server code: plugin.ts imports everything.
	const ui = await collectUiFiles(
		root,
		[...components.map(({ path }) => path), ...iconFiles, ...(iconFile ? [iconFile] : [])],
		all,
		new Set(pluginFiles)
	);

	for (const [path, svg] of Object.entries(iconifyIcons)) {
		if (path in ui.uiFiles && ui.uiFiles[path] !== svg) {
			fail([
				{
					path: ui.uiSources[path] ?? path,
					message: `is ${path} in the bundle, where Pouchbase puts the icon ${path.slice('ui/icons/'.length, -'.svg'.length).replace('/', ':')}; rename its folder`
				}
			]);
		}

		ui.uiFiles[path] = svg;
	}

	const uiCount = Object.keys(ui.uiFiles).length;

	log?.detail(
		uiCount
			? `${count(uiCount, 'file')}${ui.compiled ? `, ${ui.compiled} compiled from TypeScript` : ''}`
			: 'No UI files'
	);

	// The manifest: pouchbase-plugin.json, the contributions and package.json.
	const { $schema, ...rest } = json;
	const result = parseManifest(
		withPackageDefaults(
			{
				...($schema !== undefined ? { $schema } : {}),
				apiVersion: API_VERSION,
				...rest,
				icon: iconFile ? uiBundlePath(iconFile) : undefined,
				settings,
				server: serverCode !== null ? SERVER_FILE : undefined,
				contributes: {
					fields: fieldContributions,
					pages: pageContributions,
					authProviders: providerContributions,
					collections: collectionContributions
				}
			},
			await loadPackageJson(root)
		)
	);

	if (!result.success) {
		throw new ProjectError(`${MANIFEST_FILE} is not valid`, result.issues);
	}

	// Hosts accept any category that matches the pattern; the registry only lists known ones.
	const unknown = unknownCategoryIssues(result.manifest.categories);

	if (unknown.length) {
		throw new ProjectError(`${MANIFEST_FILE} is not valid`, unknown);
	}

	const manifest = result.manifest;
	const found: ProjectContents = {
		fields: fieldContributions.map((field) => field.type),
		pages: pageContributions.map((page) => page.path),
		authProviders: providerContributions.map((provider) => provider.id),
		collections: collectionContributions.map((collection) => collection.name),
		routes,
		settings: manifest.settings.map((setting) => setting.key)
	};

	log?.detail(`${manifest.id}@${manifest.version} (API version ${manifest.apiVersion})`);
	log?.detail(describeContents(found));

	if (manifest.permissions.network.length) {
		log?.detail(`May reach ${manifest.permissions.network.join(', ')}`);
	}

	for (const [action, names] of Object.entries(manifest.permissions.collections)) {
		if (names.length) {
			log?.detail(`May ${action} ${names.join(', ')}`);
		}
	}

	return {
		manifest,
		uiFiles: ui.uiFiles,
		uiSources: ui.uiSources,
		serverEntry,
		serverCode,
		routes,
		found,
		warnings
	};
}
