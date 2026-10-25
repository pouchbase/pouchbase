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
 */

export {
	CONVENTION_DIRS,
	describeContents,
	discoverProject,
	pagePathOf,
	readPageMeta,
	routeFileFor,
	routePathOf,
	uiBundlePath,
	type DiscoverOptions,
	type DiscoveredProject,
	type ProjectContents,
	type ProjectMode
} from './cli/discover.js';
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
