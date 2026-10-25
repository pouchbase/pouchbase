import type { Logger } from './output.js';

import { readdir, readFile } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { parseAst } from 'rolldown/parseAst';
import { transform } from 'rolldown/experimental';

import { API_VERSION } from '../api-version.js';
import { SERVER_FILE } from '../bundle.js';
import { unknownCategoryIssues } from '../categories.js';
import {
	MANIFEST_FILE,
	UI_DIR,
	authProviderContributionSchema,
	fieldContributionSchema,
	pageContributionSchema,
	parseManifest,
	pluginSettingsSchema,
	withPackageDefaults,
	type AuthProviderContribution,
	type FieldContribution,
	type ManifestIssue,
	type PageContribution,
	type PluginManifest,
	type PluginSetting
} from '../manifest.js';
import { svgIconIssues } from '../svg.js';
import { isHostModuleId } from '../ui.js';
import { DYNAMIC_IMPORT_HINT, HOST_MODULES_HINT } from './components.js';
import { count, kib } from './format.js';
import { iconifyBundlePath, isIconifyName, resolveIconifyIcon } from './icons.js';
import {
	HOST_MODULES_SUMMARY,
	IMPORT,
	checkServer,
	collectUi,
	isDynamicImport,
	isObject,
	loadManifest,
	loadPackageJson,
	missingProviderMembers,
	toPosix
} from './project.js';
import { ProjectError } from './project-error.js';
import {
	ROUTE_METHODS,
	bundleServerCode,
	generateServerEntry,
	importServerCode,
	type ServerEntryInput
} from './server-entry.js';
import { title } from './templates.js';

/**
 * Finding what a plugin project contributes. In the convention layout the folders say it:
 *
 * | File                              | Becomes                                                       |
 * | --------------------------------- | ------------------------------------------------------------- |
 * | `fields/<type>/field.ts`          | a field type; default-exports `defineField({ label, ... })`   |
 * | `fields/<type>/input.svelte`      | its input (required); `preview.svelte` its preview (optional) |
 * | `fields/<type>/icon.svg`          | its icon (optional), unless `defineField` names one           |
 * | `pages/<path>.svelte`             | a page at `/plugins/<id>/<path>`; `pages/a/index.svelte` → `a` |
 * | `pages/<path>.svg`                | its icon (optional), unless its `page` meta names one         |
 * | `auth/<id>/provider.ts`           | an auth provider; default-exports `defineAuthProvider(...)`   |
 * | `auth/<id>/icon.svg`              | its logo (optional)                                           |
 * | `routes/<path>.ts`                | routes for `/<path>`; exports `GET`, `POST`, ...              |
 * | `plugin.ts`                       | the settings; default-exports `definePlugin({ settings })`    |
 * | `icon.svg`                        | the plugin's icon (optional)                                  |
 *
 * The `icon` of `defineField` or of a page's meta is an Iconify name (`lucide:palette`), which
 * becomes `ui/icons/<prefix>/<name>.svg` in the bundle (see `icons.ts`), or the path of an `.svg`
 * file relative to the file that names it.
 *
 * `routes/index.ts` answers `/`, `routes/items/[id].ts` `/items/:id`. Files and folders whose name
 * starts with `_` are never pages or routes, so they can hold shared components and helpers; so can
 * any other folder, such as `lib/`. `pouchbase-plugin.json` keeps what isn't code: `id`, `name`,
 * `permissions`, `icon`, `categories`, `engines`, ...
 *
 * A manifest with `contributes` or `server` is the legacy layout (`ui/` and a server entry), which
 * still works with a deprecation warning; it can't be mixed with the convention folders. Its
 * settings stay in the manifest, and `plugin.ts` is not read (it may be the server entry).
 */

/** Folders whose files are contributions in the convention layout. */
export const CONVENTION_DIRS = ['fields', 'pages', 'auth', 'routes'] as const;

/** Manifest keys of the legacy layout. */
const LEGACY_KEYS = ['contributes', 'server'] as const;

/** Folders never read, wherever they are. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage']);

/** The plugin's own definition (its settings), at the root of the project. */
export const PLUGIN_FILES = ['plugin.ts', 'plugin.js'] as const;

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

/** A file that is never a page or route: tests, declarations, and `_`-prefixed names. */
const NOT_AN_ENTRY = /(?:^|\/)_|\.d\.ts$|\.(?:test|spec)\.[jt]s$/;

/** A route file: `routes/<path>.ts` or `.js`. */
const ROUTE_FILE = /\.(?:ts|js)$/;

/** `items`, `v2`, `status.json`: a static route segment. */
const ROUTE_SEGMENT = /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/;

/** `[id]`: a route param, `:id` in the route key. */
const ROUTE_PARAM = /^\[([A-Za-z_][A-Za-z0-9_]*)\]$/;

/** First segments of a route path that the host serves itself. */
const RESERVED_ROUTE_SEGMENTS = ['assets', 'modules'];

/** `stats`, `monthly-report`: one segment of a page path. */
const PAGE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `<script module>` or `<script context="module">`, with its attributes and content. */
const MODULE_SCRIPT =
	/<script\b(?=[^>]*\b(?:module\b|context\s*=\s*["']module["']))([^>]*)>([\s\S]*?)<\/script>/;

export type ProjectMode = 'convention' | 'legacy';

/** What a project contributes, by id, for messages and the CLI's summary. */
export type ProjectContents = {
	fields: string[];
	pages: string[];
	authProviders: string[];
	/** Route keys, e.g. `GET /items/:id`. */
	routes: string[];
	settings: string[];
};

export type DiscoveredProject = {
	mode: ProjectMode;
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
	 * Source of the server entry module, or `null` without server code: generated in the convention
	 * layout (see `generateServerEntry`), a re-export of the manifest's `server` in the legacy one.
	 * It imports project files by their absolute path, so a bundler can serve it as a virtual module.
	 */
	serverEntry: string | null;
	/** `serverEntry` bundled into one module without imports, as `server.js` of the bundle. */
	serverCode: string | null;
	/** Route keys of the server code, sorted as found. */
	routes: string[];
	found: ProjectContents;
	/** Problems that don't stop a build, such as the legacy layout's deprecation. */
	warnings: ManifestIssue[];
};

export type DiscoverOptions = {
	/** Reports every step, like the other commands. */
	log?: Logger;
};

/** A problem with the layout: where, what, and how to fix it. */
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

/** The legacy keys a manifest has. */
function legacyKeys(json: Record<string, unknown>) {
	return LEGACY_KEYS.filter((key) => json[key] !== undefined);
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
		listed(found.routes, 'route'),
		listed(found.settings, 'setting')
	].filter((part) => part !== null);

	return parts.length ? `Found ${parts.join(', ')}` : 'Found nothing to contribute yet';
}

/** The contents of a manifest's `contributes`, for the legacy layout. */
function manifestContents(manifest: PluginManifest, routes: string[]): ProjectContents {
	return {
		fields: manifest.contributes.fields.map((field) => field.type),
		pages: manifest.contributes.pages.map((page) => page.path),
		authProviders: manifest.contributes.authProviders.map((provider) => provider.id),
		routes,
		settings: manifest.settings.map((setting) => setting.key)
	};
}

/**
 * Finds what the plugin in `root` contributes and builds its manifest, UI files and server code:
 * from the folders in the convention layout, from `pouchbase-plugin.json` in the legacy layout.
 * Throws a `ProjectError` for every problem, with the file it concerns and a hint.
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
	const legacy = legacyKeys(json);
	const conventionDirs = CONVENTION_DIRS.filter((dir) =>
		files.some((file) => file.startsWith(`${dir}/`))
	);

	if (legacy.length && conventionDirs.length) {
		throw new ProjectError(
			`${MANIFEST_FILE} has ${legacy.map((key) => `"${key}"`).join(' and ')}, but the plugin also has ${conventionDirs.map((dir) => `${dir}/`).join(', ')}`,
			[],
			`Use one layout: move the contributions into ${CONVENTION_DIRS.map((dir) => `${dir}/`).join(', ')} and remove ${legacy.map((key) => `"${key}"`).join(' and ')} from ${MANIFEST_FILE} (the convention layout), or move those folders out of the way.`
		);
	}

	return legacy.length
		? discoverLegacy(root, files, log)
		: discoverConvention(root, json, files, log);
}

/** The legacy layout: the manifest lists the contributions, `ui/` and `server` hold the code. */
async function discoverLegacy(
	root: string,
	files: string[],
	log?: Logger
): Promise<DiscoveredProject> {
	const manifest = await loadManifest(root);
	const warnings: ManifestIssue[] = [
		{
			path: MANIFEST_FILE,
			message: `"contributes" and "server" are deprecated and stop working in plugin API version 2: move the contributions into ${CONVENTION_DIRS.map((dir) => `${dir}/`).join(', ')} (see the README of @pouchbasejs/plugin-sdk)`
		}
	];

	log?.detail(
		`${manifest.id}@${manifest.version} (API version ${manifest.apiVersion}), legacy layout`
	);

	if (manifest.permissions.network.length) {
		log?.detail(`May reach ${manifest.permissions.network.join(', ')}`);
	}

	log?.step(`Checking ${UI_DIR}/`);

	const ui = await collectUi(root);
	const uiCount = Object.keys(ui.files).length;

	log?.detail(
		uiCount
			? `${count(uiCount, 'file')}${ui.compiled ? `, ${ui.compiled} compiled from TypeScript` : ''}`
			: `No files in ${UI_DIR}/`
	);

	for (const path of ui.skipped) {
		log?.debug(`Left out ${path}: not a .svelte, .ts, .js, .css, .json or .svg file`);
	}

	const routes: string[] = [];
	let serverEntry: string | null = null;
	let serverCode: string | null = null;

	if (manifest.server) {
		log?.step(`Bundling ${manifest.server}`);

		serverCode = await bundleServerCode(root, { file: manifest.server });
		serverEntry = `export { default } from ${JSON.stringify(toPosix(join(root, manifest.server)))};\n`;

		log?.detail(`${kib(Buffer.byteLength(serverCode))} of server code, in one module`);
		log?.step('Checking the server handlers against the manifest');

		const result = await checkServer(manifest, serverCode);

		if (result.issues.length) {
			throw new ProjectError('The server code does not match the manifest', result.issues);
		}

		warnings.push(...result.warnings);
		routes.push(...(result.routes ?? []));
	} else {
		log?.debug('No server code (no "server" in the manifest)');
	}

	const found = manifestContents(manifest, routes);

	log?.detail(describeContents(found));

	return {
		mode: 'legacy',
		manifest: { ...manifest, server: manifest.server ? SERVER_FILE : undefined },
		uiFiles: ui.files,
		uiSources: Object.fromEntries(
			Object.keys(ui.files).map((path) => {
				const typescript = path.replace(/\.js$/, '.ts');

				return [path, path.endsWith('.js') && files.includes(typescript) ? typescript : path];
			})
		),
		serverEntry,
		serverCode,
		routes,
		found,
		warnings
	};
}

// Names

/** Why `name` can't be an id, when it has capitals: the most common mistake. */
function lowercaseHint(name: string) {
	return /[A-Z]/.test(name) ? 'use lowercase names' : null;
}

/** The route path of a file in `routes/`, e.g. `routes/items/[id].ts` → `/items/:id`. */
export function routePathOf(file: string): { path: string } | { problem: string } {
	const segments = file.slice('routes/'.length).replace(ROUTE_FILE, '').split('/');

	if (segments.at(-1) === 'index') {
		segments.pop();
	}

	const parts: string[] = [];

	for (const segment of segments) {
		const param = ROUTE_PARAM.exec(segment);

		if (param) {
			parts.push(`:${param[1]}`);
		} else if (ROUTE_SEGMENT.test(segment)) {
			parts.push(segment);
		} else {
			return {
				problem:
					lowercaseHint(segment) ??
					`"${segment}" can't be part of a route path; use lowercase words separated by dashes, or [name] for a param`
			};
		}
	}

	if (parts[0] && RESERVED_ROUTE_SEGMENTS.includes(parts[0])) {
		return {
			problem: `/${parts[0]} is served by Pouchbase itself (${RESERVED_ROUTE_SEGMENTS.map((segment) => `/${segment}`).join(', ')}); use another path`
		};
	}

	return { path: `/${parts.join('/')}` };
}

/**
 * The file in `routes/` for a route path: `/` → `routes/index.ts`, `items/:id` or `/items/[id]` →
 * `routes/items/[id].ts`; `null` when it can't be one.
 */
export function routeFileFor(path: string): string | null {
	const segments = path
		.trim()
		.split('/')
		.filter(Boolean)
		.map((segment) => (segment.startsWith(':') ? `[${segment.slice(1)}]` : segment));
	const file = `routes/${segments.length ? segments.join('/') : 'index'}.ts`;
	const result = routePathOf(file);

	return 'path' in result ? file : null;
}

/** The page path of a `.svelte` file in `pages/`, e.g. `pages/reports/index.svelte` → `reports`. */
export function pagePathOf(file: string): { path: string } | { problem: string } {
	const segments = file.slice('pages/'.length, -'.svelte'.length).split('/');

	if (segments.at(-1) === 'index') {
		segments.pop();
	}

	if (!segments.length) {
		return {
			problem:
				'a page needs a path below /plugins/<id>/; give the file a name, e.g. pages/overview.svelte'
		};
	}

	for (const segment of segments) {
		if (!PAGE_SEGMENT.test(segment)) {
			return {
				problem:
					lowercaseHint(segment) ??
					`"${segment}" can't be part of a page path; use lowercase words separated by dashes`
			};
		}
	}

	return { path: segments.join('/') };
}

// Page metadata

/** The value of a literal expression, or `undefined` when it isn't one. */
function literal(node: unknown): { value: unknown } | undefined {
	if (!isObject(node)) {
		return undefined;
	}

	switch (node.type) {
		case 'Literal':
			return node.regex !== undefined || node.bigint !== undefined
				? undefined
				: { value: node.value };
		case 'TemplateLiteral': {
			const quasis = node.quasis as { value: { cooked: string } }[];

			return (node.expressions as unknown[]).length
				? undefined
				: { value: quasis[0]?.value.cooked };
		}
		case 'UnaryExpression': {
			const argument = literal(node.argument);

			return node.operator === '-' && typeof argument?.value === 'number'
				? { value: -argument.value }
				: undefined;
		}
		case 'TSSatisfiesExpression':
		case 'TSAsExpression':
		case 'ParenthesizedExpression':
			return literal(node.expression);
		case 'CallExpression': {
			// `definePage({ ... })` returns its argument.
			const callee = node.callee as { type?: string; name?: string };
			const args = node.arguments as unknown[];

			return callee.type === 'Identifier' && callee.name === 'definePage' && args.length === 1
				? literal(args[0])
				: undefined;
		}
		case 'ArrayExpression': {
			const values: unknown[] = [];

			for (const element of node.elements as unknown[]) {
				const item = literal(element);

				if (!item) {
					return undefined;
				}

				values.push(item.value);
			}

			return { value: values };
		}
		case 'ObjectExpression': {
			const value: Record<string, unknown> = {};

			for (const property of node.properties as Record<string, unknown>[]) {
				const key = property.key as { type?: string; name?: string; value?: unknown };
				const name =
					property.type === 'Property' && !property.computed && property.kind === 'init'
						? key.type === 'Identifier'
							? key.name
							: typeof key.value === 'string'
								? key.value
								: undefined
						: undefined;
				const item = name === undefined ? undefined : literal(property.value);

				if (name === undefined || !item) {
					return undefined;
				}

				value[name] = item.value;
			}

			return { value };
		}
		default:
			return undefined;
	}
}

/**
 * The `page` export of a page's `<script module>`: `export const page = { title: 'Stats' }`, a
 * literal (it may use `satisfies PageMeta`, but no imports or variables). `{}` without one.
 */
export function readPageMeta(
	file: string,
	source: string
):
	| { meta: { title?: unknown; navigation?: unknown; icon?: unknown; order?: unknown } }
	| { problem: string } {
	const script = MODULE_SCRIPT.exec(source);

	if (!script) {
		return { meta: {} };
	}

	let program: { body: Record<string, unknown>[] };

	try {
		program = parseAst(script[2] ?? '', { lang: 'ts' }, file) as unknown as typeof program;
	} catch (error) {
		return { problem: `can't parse <script module>: ${(error as Error).message}` };
	}

	for (const statement of program.body) {
		const declaration = statement.declaration as Record<string, unknown> | null | undefined;

		if (
			statement.type !== 'ExportNamedDeclaration' ||
			declaration?.type !== 'VariableDeclaration'
		) {
			continue;
		}

		for (const declarator of declaration.declarations as Record<string, unknown>[]) {
			const id = declarator.id as { type?: string; name?: string };

			if (id.type !== 'Identifier' || id.name !== 'page') {
				continue;
			}

			const value = literal(declarator.init);

			if (!value || !isObject(value.value)) {
				return {
					problem:
						"export const page must be a literal object, e.g. { title: 'Stats' }; it can't use imports, variables or function calls"
				};
			}

			return { meta: value.value };
		}
	}

	return { meta: {} };
}

// UI files

/** Files of the project that are server code only, so UI files can't import them. */
function isServerFile(path: string) {
	return (
		(PLUGIN_FILES as readonly string[]).includes(path) ||
		path.startsWith('routes/') ||
		/^fields\/[^/]+\/field\.[jt]s$/.test(path) ||
		/^auth\/[^/]+\/provider\.[jt]s$/.test(path)
	);
}

/** The bundle path of a UI file of the project: `lib/stars.ts` → `ui/lib/stars.js`. */
export function uiBundlePath(path: string) {
	return `${UI_DIR}/${path.replace(/\.ts$/, '.js')}`;
}

/**
 * The UI files of the bundle in the convention layout: `entries` (inputs, previews, pages and
 * images) and every project file they import, each under `ui/` at its project path.
 */
async function collectConventionUi(root: string, entries: readonly string[], all: Set<string>) {
	const uiFiles: Record<string, string> = {};
	const uiSources: Record<string, string> = {};
	const problems: Problem[] = [];
	const queue = [...entries];
	const seen = new Set<string>();
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
				} else if (isServerFile(resolved)) {
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

/** Keys `definePlugin(...)` may have in `plugin.ts`; the folders hold the rest. */
const PLUGIN_FILE_KEYS = ['settings'];

/**
 * The settings of `plugin.ts` (or `.js`): bundled and run like `field.ts`, its default export is
 * `definePlugin({ settings: [...] })`; the settings are checked like the manifest's.
 */
async function readPluginFile(root: string, file: string): Promise<PluginSetting[]> {
	const code = await bundleServerCode(root, { file });
	let definition: unknown;

	try {
		definition = await importServerCode(code);
	} catch (error) {
		throw new ProjectError(
			`Can't load ${file} to read its settings: ${(error as Error).message}`,
			[],
			`The CLI runs ${file} in Node.js; keep its top level free of APIs that only the sandbox has.`
		);
	}

	if (!isObject(definition)) {
		fail([
			{
				path: file,
				message: 'must default-export definePlugin({ settings: [...] })',
				hint: "import { definePlugin } from '@pouchbasejs/plugin-sdk/server'; export default definePlugin({ settings: [{ key: 'api_key', label: 'API key', type: 'secret' }] });"
			}
		]);
	}

	const problems: Problem[] = Object.keys(definition)
		.filter((key) => !PLUGIN_FILE_KEYS.includes(key))
		.map((key) => ({
			path: file,
			message: `definePlugin({ ${key} }) isn't read from ${file}; it only holds the settings`,
			hint: 'Field types, auth providers and routes come from fields/, auth/ and routes/.'
		}));
	const result = pluginSettingsSchema.safeParse(definition.settings ?? []);

	if (!result.success) {
		problems.push(
			...result.error.issues.map((issue) => ({
				path: file,
				message: `${['settings', ...issue.path].join('.')}: ${issue.message}`
			}))
		);
	}

	if (problems.length || !result.success) {
		fail(problems, `Problems in ${file}`);
	}

	return result.data;
}

// Convention layout

type FieldFiles = {
	type: string;
	dir: string;
	field: string;
	input: string;
	/** `preview.svelte`, or the deprecated `cell.svelte`. */
	preview: string | null;
	/** `icon.svg` in the folder, used when `defineField` names no icon. */
	icon: string | null;
};

type ProviderFiles = { id: string; file: string; icon: string | null };

/** The convention layout: the folders say what the plugin contributes. */
async function discoverConvention(
	root: string,
	json: Record<string, unknown>,
	files: string[],
	log?: Logger
): Promise<DiscoveredProject> {
	const all = new Set(files);
	const problems: Problem[] = [];
	const warnings: ManifestIssue[] = [];
	const fields: FieldFiles[] = [];
	const providers: ProviderFiles[] = [];
	const routeFiles: { path: string; file: string }[] = [];
	const pageFiles: { path: string; file: string }[] = [];

	log?.detail(`${typeof json.id === 'string' ? json.id : 'The plugin'}, convention layout`);

	// Settings are code in the convention layout, so they are typed.
	if (json.settings !== undefined) {
		problems.push({
			path: MANIFEST_FILE,
			message: '"settings" belongs in plugin.ts in the convention layout',
			hint: 'Move the settings to definePlugin({ settings }) in plugin.ts and remove "settings" from pouchbase-plugin.json; pouchbase-plugin add setting <key> creates plugin.ts.'
		});
	}

	const pluginFiles = PLUGIN_FILES.filter((file) => all.has(file));

	if (pluginFiles.length > 1) {
		problems.push({
			path: pluginFiles.join(', '),
			message: 'the plugin has both; keep one of them'
		});
	}

	log?.step(`Looking for ${CONVENTION_DIRS.map((dir) => `${dir}/`).join(', ')}`);

	// fields/<type>/
	const fieldDirs = new Set(
		files
			.flatMap((file) => /^fields\/([^/]+)\//.exec(file)?.[1] ?? [])
			.filter((dir) => !dir.startsWith('_'))
	);

	for (const type of fieldDirs) {
		const dir = `fields/${type}`;

		if (!fieldContributionSchema.shape.type.safeParse(type).success) {
			problems.push({
				path: dir,
				message:
					lowercaseHint(type) ??
					`"${type}" can't be a field type; use lowercase letters, numbers and underscores, e.g. rating`
			});
			continue;
		}

		const field = [`${dir}/field.ts`, `${dir}/field.js`].find((file) => all.has(file));
		const input = `${dir}/input.svelte`;
		const preview = `${dir}/preview.svelte`;
		// The former name of the preview, still read in plugin API version 1.
		const cell = `${dir}/cell.svelte`;

		if (!field) {
			problems.push({
				path: dir,
				message: `has no field.ts: every field type default-exports defineField({ label, description, column }) from it`,
				hint: `pouchbase-plugin add field <type> shows what the files of a field type look like.`
			});
		}

		if (!all.has(input)) {
			problems.push({
				path: dir,
				message: `has no input.svelte: every field type needs an input component`,
				hint: `pouchbase-plugin add field <type> shows what the files of a field type look like.`
			});
		}

		if (all.has(cell)) {
			warnings.push({
				path: cell,
				message: all.has(preview)
					? 'is ignored next to preview.svelte; remove it'
					: 'is the former name of preview.svelte, which shows the value in the records grid; rename it to preview.svelte'
			});
		}

		if (field && all.has(input)) {
			fields.push({
				type,
				dir,
				field,
				input,
				preview: all.has(preview) ? preview : all.has(cell) ? cell : null,
				icon: all.has(`${dir}/icon.svg`) ? `${dir}/icon.svg` : null
			});
		}
	}

	// pages/**/*.svelte
	for (const file of files) {
		if (!file.startsWith('pages/') || !file.endsWith('.svelte') || NOT_AN_ENTRY.test(file)) {
			continue;
		}

		const result = pagePathOf(file);

		if ('problem' in result) {
			problems.push({ path: file, message: result.problem });
			continue;
		}

		const other = pageFiles.find((page) => page.path === result.path);

		if (other) {
			problems.push({
				path: file,
				message: `is the page ${result.path}, like ${other.file}; keep one of them`
			});
			continue;
		}

		pageFiles.push({ path: result.path, file });
	}

	// auth/<id>/
	const providerDirs = new Set(
		files
			.flatMap((file) => /^auth\/([^/]+)\//.exec(file)?.[1] ?? [])
			.filter((dir) => !dir.startsWith('_'))
	);

	for (const id of providerDirs) {
		const dir = `auth/${id}`;
		const idResult = authProviderContributionSchema.shape.id.safeParse(id);

		if (!idResult.success) {
			problems.push({
				path: dir,
				message:
					lowercaseHint(id) ??
					`"${id}" can't be a provider id: ${idResult.error.issues[0]?.message ?? 'invalid'}`
			});
			continue;
		}

		const file = [`${dir}/provider.ts`, `${dir}/provider.js`].find((path) => all.has(path));

		if (!file) {
			problems.push({
				path: dir,
				message:
					'has no provider.ts: every auth provider default-exports defineAuthProvider({ ... }) from it',
				hint: 'pouchbase-plugin add auth-provider <id> shows what the files of an auth provider look like.'
			});
			continue;
		}

		providers.push({ id, file, icon: all.has(`${dir}/icon.svg`) ? `${dir}/icon.svg` : null });
	}

	// routes/**/*.ts
	for (const file of files) {
		if (!file.startsWith('routes/') || !ROUTE_FILE.test(file) || NOT_AN_ENTRY.test(file)) {
			continue;
		}

		const result = routePathOf(file);

		if ('problem' in result) {
			problems.push({ path: file, message: result.problem });
			continue;
		}

		const shape = result.path.replace(/:[^/]+/g, ':');
		const other = routeFiles.find((route) => route.path.replace(/:[^/]+/g, ':') === shape);

		if (other) {
			problems.push({
				path: file,
				message: `answers ${result.path}, like ${other.file}; keep one of them`
			});
			continue;
		}

		routeFiles.push({ path: result.path, file });
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

	if (problems.length) {
		fail(problems);
	}

	const folders = [
		fields.length && count(fields.length, 'field type'),
		pageFiles.length && count(pageFiles.length, 'page'),
		providers.length && count(providers.length, 'auth provider'),
		routeFiles.length && count(routeFiles.length, 'route file')
	].filter(Boolean);

	log?.detail(folders.length ? folders.join(', ') : 'None of them has contributions yet');

	// plugin.ts: the settings.
	const pluginFile = pluginFiles[0] ?? null;
	let settings: PluginSetting[] = [];

	if (pluginFile) {
		log?.step(`Reading the settings in ${pluginFile}`);

		settings = await readPluginFile(root, pluginFile);

		log?.detail(
			settings.length
				? `${count(settings.length, 'setting')}: ${settings.map((setting) => `${setting.key} (${setting.type})`).join(', ')}`
				: 'No settings'
		);
	} else {
		log?.debug('No plugin.ts, so no settings');
	}

	// Server code: one generated entry for every field type, auth provider and route file. The
	// first build finds the methods of the route files; the second has a literal key per route.
	const entryInput: ServerEntryInput = {
		fields: fields.map(({ type, field }) => ({ type, file: field })),
		authProviders: providers.map(({ id, file }) => ({ id, file })),
		routes: routeFiles,
		plugin: pluginFile
	};
	const hasServer = fields.length + providers.length + routeFiles.length > 0;
	let serverEntry = hasServer ? generateServerEntry(entryInput, { root }) : null;
	let serverCode: string | null = null;
	let definition: Record<string, unknown> = {};

	if (serverEntry !== null) {
		log?.step('Bundling the server code');

		serverCode = await bundleServerCode(root, { source: serverEntry }, 'the server code');

		log?.step('Reading the field types, auth providers and routes');

		try {
			const loaded = await importServerCode(serverCode);

			definition = isObject(loaded) ? loaded : {};
		} catch (error) {
			throw new ProjectError(
				`Can't load the server code to read its field types, auth providers and routes: ${(error as Error).message}`,
				[],
				'The CLI runs the server code in Node.js to read what it exports; keep the top level of field.ts, provider.ts and route files free of APIs that only the sandbox has.'
			);
		}
	}

	const handlers = {
		fields: isObject(definition.fields) ? definition.fields : {},
		authProviders: isObject(definition.authProviders) ? definition.authProviders : {},
		routes: isObject(definition.routes) ? definition.routes : {}
	};

	if (serverEntry !== null && routeFiles.length) {
		const keys = Object.keys(handlers.routes);

		serverEntry = generateServerEntry(
			{
				...entryInput,
				routes: routeFiles.map((route) => ({
					...route,
					methods: ROUTE_METHODS.filter((method) => keys.includes(`${method} ${route.path}`))
				}))
			},
			{ root }
		);
		serverCode = await bundleServerCode(root, { source: serverEntry }, 'the server code');
	}

	if (serverCode !== null) {
		log?.detail(`${kib(Buffer.byteLength(serverCode))} of server code, in one module`);
	}

	// Icons of field types and pages: an Iconify name becomes a file of the bundle, a project file
	// is a UI file like the components. Both are checked like a host checks them.
	const iconifyIcons: Record<string, string> = {};
	const iconFiles: string[] = [];

	/** An icon from a project file, checked; its bundle path, or `undefined` after a problem. */
	async function fileIcon(path: string): Promise<string | undefined> {
		const issues = svgIconIssues(await readFile(join(root, path), 'utf8'));

		if (issues.length) {
			problems.push(
				...issues.map((message) => ({
					path,
					message,
					hint: 'Icons are plain SVG images, drawn in one color by Pouchbase; an Iconify name (e.g. lucide:palette) gives one.'
				}))
			);

			return undefined;
		}

		iconFiles.push(path);

		return uiBundlePath(path);
	}

	/**
	 * The bundle path of a contribution's icon: `value` (an Iconify name, or a path relative to
	 * `file`), else the file `fallback` when it exists; `undefined` for none or after a problem.
	 */
	async function contributionIcon(
		value: unknown,
		fallback: string | null,
		file: string,
		label: string,
		key: string
	): Promise<string | undefined> {
		if (value === undefined) {
			return fallback ? fileIcon(fallback) : undefined;
		}

		if (typeof value !== 'string' || !value.trim()) {
			problems.push({
				path: file,
				message: `${key} must be an Iconify name, e.g. lucide:palette, or the path of an .svg file`
			});

			return undefined;
		}

		if (isIconifyName(value)) {
			try {
				const { svg, source } = await resolveIconifyIcon(root, value, { log, label });
				const path = iconifyBundlePath(value);

				iconifyIcons[path] = svg;
				log?.detail(`Resolved icon ${value} for ${label} (${source})`);

				return path;
			} catch (error) {
				if (!(error instanceof ProjectError)) {
					throw error;
				}

				problems.push({ path: file, message: `${key}: ${error.message}`, hint: error.hint });

				return undefined;
			}
		}

		const path = posix.normalize(posix.join(posix.dirname(file), value));

		if (!path.endsWith('.svg') || path.startsWith('../') || !all.has(path)) {
			problems.push({
				path: file,
				message: `${key}: ${value} ${path.endsWith('.svg') ? "doesn't exist in the plugin" : 'must be an .svg file'}`,
				hint: 'Give an Iconify name, e.g. lucide:palette, or the path of an .svg file relative to this file.'
			});

			return undefined;
		}

		return fileIcon(path);
	}

	// Field types: label, description, column and icon come from defineField(...).
	const fieldContributions: FieldContribution[] = [];

	for (const { type, field, input, preview, icon: iconFile } of fields) {
		const handler = handlers.fields[type];

		if (!isObject(handler)) {
			problems.push({ path: field, message: 'must default-export defineField({ ... })' });
			continue;
		}

		const icon = await contributionIcon(
			handler.icon,
			iconFile,
			field,
			`field ${type}`,
			'defineField icon'
		);
		const contribution = {
			type,
			label: handler.label ?? title(type),
			description: handler.description,
			column: handler.column,
			input: uiBundlePath(input),
			...(preview ? { preview: uiBundlePath(preview) } : {}),
			...(icon ? { icon } : {})
		};
		const result = fieldContributionSchema.safeParse(contribution);

		if (!result.success) {
			for (const issue of result.error.issues) {
				const key = issue.path.join('.');

				problems.push({
					path: field,
					message:
						key === 'description' && handler.description === undefined
							? 'defineField needs a description: one sentence shown when an admin picks the type'
							: key === 'column' && handler.column === undefined
								? 'defineField needs a column: TEXT, INTEGER, REAL or BLOB, the storage class of the value'
								: `${key}: ${issue.message}`
				});
			}

			continue;
		}

		fieldContributions.push(result.data);
	}

	// Auth providers: label and consoleUrl come from defineAuthProvider(...).
	const providerContributions: AuthProviderContribution[] = [];

	for (const { id, file, icon } of providers) {
		const handler = handlers.authProviders[id];

		if (!isObject(handler)) {
			problems.push({ path: file, message: 'must default-export defineAuthProvider({ ... })' });
			continue;
		}

		const missing = missingProviderMembers(handler);

		if (missing.length) {
			problems.push({ path: file, message: `the provider lacks ${missing.join(', ')}` });
			continue;
		}

		const result = authProviderContributionSchema.safeParse({
			id,
			label: handler.label ?? title(id),
			...(handler.consoleUrl !== undefined ? { consoleUrl: handler.consoleUrl } : {}),
			...(icon ? { icon: uiBundlePath(icon) } : {})
		});

		if (!result.success) {
			problems.push(
				...result.error.issues.map((issue) => ({
					path: file,
					message: `${issue.path.join('.')}: ${issue.message}`
				}))
			);
			continue;
		}

		providerContributions.push(result.data);
	}

	// Routes: every function a route file exports under a method name.
	const routes = Object.keys(handlers.routes);

	for (const { path, file } of routeFiles) {
		if (!routes.some((key) => key.slice(key.indexOf(' ') + 1) === path)) {
			problems.push({
				path: file,
				message: `exports no ${ROUTE_METHODS.join(', ')} function`,
				hint: 'Export a handler per method, e.g. export const GET: RouteHandler = (request, ctx) => Response.json({ ok: true });'
			});
		}
	}

	// Pages: title and navigation come from `export const page = { ... }` in <script module>.
	if (pageFiles.length) {
		log?.step('Reading the pages');
	}

	const orderedPages: { page: PageContribution; order: number }[] = [];

	for (const { path, file } of pageFiles) {
		const result = readPageMeta(file, await readFile(join(root, file), 'utf8'));

		if ('problem' in result) {
			problems.push({ path: file, message: result.problem });
			continue;
		}

		const { order = Infinity } = result.meta;

		if (typeof order !== 'number' || Number.isNaN(order)) {
			problems.push({ path: file, message: 'page.order must be a number, e.g. 1' });
			continue;
		}

		const sibling = file.replace(/\.svelte$/, '.svg');
		const icon = await contributionIcon(
			result.meta.icon,
			all.has(sibling) ? sibling : null,
			file,
			`page ${path}`,
			'page.icon'
		);
		const contribution = pageContributionSchema.safeParse({
			path,
			title: result.meta.title ?? title(path),
			component: uiBundlePath(file),
			...(result.meta.navigation !== undefined ? { navigation: result.meta.navigation } : {}),
			...(icon ? { icon } : {})
		});

		if (!contribution.success) {
			problems.push(
				...contribution.error.issues.map((issue) => ({
					path: file,
					message: `page.${issue.path.join('.')}: ${issue.message}`
				}))
			);
			continue;
		}

		orderedPages.push({ page: contribution.data, order });
	}

	// By `order`, then in the order the files were found: `sort` keeps that for equal orders.
	const pageContributions = orderedPages
		.sort((a, b) => (a.order === b.order ? 0 : a.order < b.order ? -1 : 1))
		.map(({ page }) => page);

	if (problems.length) {
		fail(problems);
	}

	log?.step('Checking the UI files');

	const ui = await collectConventionUi(
		root,
		[
			...fields.flatMap(({ input, preview }) => (preview ? [input, preview] : [input])),
			...pageFiles.map(({ file }) => file),
			...providers.flatMap(({ icon }) => icon ?? []),
			...iconFiles,
			...(iconFile ? [iconFile] : [])
		],
		all
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
					authProviders: providerContributions
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
		routes,
		settings: manifest.settings.map((setting) => setting.key)
	};

	log?.detail(`${manifest.id}@${manifest.version} (API version ${manifest.apiVersion})`);
	log?.detail(describeContents(found));

	if (manifest.permissions.network.length) {
		log?.detail(`May reach ${manifest.permissions.network.join(', ')}`);
	}

	return {
		mode: 'convention',
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
