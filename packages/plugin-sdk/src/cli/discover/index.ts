import type { Logger } from '../output.js';

import { resolve } from 'node:path';

import { API_VERSION } from '../../api-version.js';
import { SERVER_FILE } from '../../bundle.js';
import { unknownCategoryIssues } from '../../categories.js';
import {
	GENERATED_MANIFEST_KEYS,
	MANIFEST_FILE,
	parseManifest,
	type ManifestIssue,
	type PluginManifest
} from '../../manifest.js';
import { count, kib } from '../format.js';
import { withPackageDefaults } from '../package-defaults.js';
import { loadPackageJson } from '../project.js';
import { ProjectError } from '../project-error.js';
import { bundleServerCode, generateServerEntry } from '../server-entry.js';
import { readDefinition } from './definition.js';
import { projectFiles, readManifestJson } from './files.js';
import { fail, type Problem } from './problems.js';
import { collectUiFiles, uiBundlePath } from './ui-files.js';

export { routeFileFor, routePathFor, routePathProblem } from './ids.js';
export { uiBundlePath } from './ui-files.js';

/**
 * Finding what a plugin project contributes. `plugin.ts` says it all: its default export is
 * `definePlugin({ settings, fields, pages, authProviders, collections, routes, functions })`, and it imports the code,
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

/** The plugin's definition, at the root of the project. */
export const PLUGIN_FILES = ['plugin.ts', 'plugin.js'] as const;

/** What a project contributes, by id, for messages and the CLI's summary. */
export type ProjectContents = {
	fields: string[];
	pages: string[];
	authProviders: string[];
	/** Names of the plugin's collections, without the prefix. */
	collections: string[];
	/** Route keys, e.g. `GET /items/:id`. */
	routes: string[];
	/** Names of the plugin's functions, without the prefix. */
	functions: string[];
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
		listed(found.functions, 'function'),
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

	const {
		settings,
		fields: fieldContributions,
		pages: pageContributions,
		authProviders: providerContributions,
		collections: collectionContributions,
		routes,
		functions: functionContributions,
		components,
		iconFiles,
		iconifyIcons
	} = await readDefinition(root, file, log);

	const contents = [
		fieldContributions.length && count(fieldContributions.length, 'field type'),
		pageContributions.length && count(pageContributions.length, 'page'),
		providerContributions.length && count(providerContributions.length, 'auth provider'),
		collectionContributions.length && count(collectionContributions.length, 'collection'),
		routes.length && count(routes.length, 'route'),
		functionContributions.length && count(functionContributions.length, 'function'),
		settings.length && count(settings.length, 'setting')
	].filter(Boolean);

	log?.detail(contents.length ? contents.join(', ') : 'Nothing to contribute yet');

	// Server code: the generated entry turns the definition into what the host runs.
	const hasServer =
		fieldContributions.length +
			providerContributions.length +
			routes.length +
			functionContributions.length >
		0;
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
					collections: collectionContributions,
					functions: functionContributions
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
		functions: functionContributions.map((fn) => fn.name),
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
