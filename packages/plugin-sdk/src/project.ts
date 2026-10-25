/**
 * Reading a plugin project on disk, for tools that build plugins themselves, such as the Vite
 * plugin that embeds Pouchbase's built-in plugins. Node.js only: it reads files and bundles the
 * server code with rolldown.
 *
 * ```ts
 * import { discoverProject } from '@pouchbasejs/plugin-sdk/project';
 *
 * const project = await discoverProject('plugins/auth-google');
 * // project.manifest, project.uiFiles, project.serverEntry, project.routes, ...
 * ```
 *
 * The generated server entry imports `plugin.ts`, which imports `.svelte` and `.svg` files; a
 * bundler that compiles it needs `pluginFiles()` to turn those into `PluginFile`s.
 */

export {
	PLUGIN_FILES,
	describeContents,
	discoverProject,
	routeFileFor,
	routePathFor,
	routePathProblem,
	uiBundlePath,
	type DiscoverOptions,
	type DiscoveredProject,
	type ProjectContents
} from './cli/discover.js';
export {
	PLUGIN_FILE_IMPORT,
	pluginFileOfId,
	pluginFiles,
	type PluginFilesOptions,
	type PluginFilesPlugin
} from './vite.js';
export { ProjectError } from './cli/project-error.js';
export { buildBundle, bundleFileName } from './cli/project.js';
export {
	ROUTE_METHODS,
	SERVER_ENTRY_ID,
	bundleServerCode,
	generateServerEntry,
	importServerCode,
	type ServerEntryInput,
	type ServerEntryOptions
} from './cli/server-entry.js';
