import type { DiscoveredProject } from '../packages/plugin-sdk/src/project.ts';
import type { EnvironmentModuleNode, Plugin } from 'vite';

import { discoverProject } from '../packages/plugin-sdk/src/project.ts';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/**
 * The built-in plugins: the first-party plugins in `plugins/*`, read like `pouchbase-plugin build`
 * reads a project (`discoverProject()` of `@pouchbasejs/plugin-sdk/project`), so they use the same
 * layout as any other plugin. Exposes:
 *
 * - `virtual:pouchbase/embedded-plugins`: `plugins`, every plugin's manifest as its bundle has it
 *   (`contributes` included), its `.svg` files by bundle path (`ui/auth/google/icon.svg`) and a
 *   loader of its server code; `issues`, the folders that couldn't be read.
 * - `virtual:pouchbase/embedded-plugins/server/<folder>`: the plugin's generated server entry, which
 *   imports its real source files, so Vite compiles them and watches them in dev.
 *
 * `src/lib/server/plugins/embedded.ts` reads them. In dev, a change in `plugins/<folder>/` reads
 * that plugin again and reloads both modules on the server. The components (`.svelte`) are not
 * here: the dashboard imports them itself (`src/lib/plugins/module-loader.ts`).
 *
 * The SDK is imported from its sources by path, not as `@pouchbasejs/plugin-sdk/project`: Vite
 * bundles the config file and its relative imports, but loads packages with Node.js, which can't
 * run the SDK's TypeScript sources (they import `./cli/discover.js` for `discover.ts`). This way
 * `pnpm dev`, `pnpm build` and vitest need no build of the SDK first.
 */

export const EMBEDDED_PLUGINS_ID = 'virtual:pouchbase/embedded-plugins';
const SERVER_PREFIX = `${EMBEDDED_PLUGINS_ID}/server/`;
const RESOLVED_ID = `\0${EMBEDDED_PLUGINS_ID}`;
const RESOLVED_SERVER_PREFIX = `\0${SERVER_PREFIX}`;

/** Folders of a plugin whose changes don't change what it contributes. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'test']);

/** What discovery found in one folder of `plugins/`. */
type Discovery = { project: DiscoveredProject } | { error: string };

export type EmbeddedPluginsOptions = {
	/** The folder of the plugins, relative to the Vite root. Defaults to `plugins`. */
	dir?: string;
};

export function embeddedPlugins(options: EmbeddedPluginsOptions = {}): Plugin {
	const dirName = options.dir ?? 'plugins';
	let root = process.cwd();
	/** Folder name → discovery, started on first use and dropped when the folder changes. */
	const discoveries = new Map<string, Promise<Discovery>>();
	/** Folders whose warnings were printed, so a reload doesn't repeat them. */
	const warned = new Set<string>();

	function pluginsDir() {
		return resolve(root, dirName);
	}

	/** Folders of `plugins/` with a `pouchbase-plugin.json`, sorted. */
	function folders(): string[] {
		const dir = pluginsDir();

		if (!existsSync(dir)) {
			return [];
		}

		return readdirSync(dir, { withFileTypes: true })
			.filter(
				(entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'pouchbase-plugin.json'))
			)
			.map((entry) => entry.name)
			.sort((a, b) => a.localeCompare(b));
	}

	function discover(folder: string): Promise<Discovery> {
		let discovery = discoveries.get(folder);

		if (!discovery) {
			discovery = discoverProject(join(pluginsDir(), folder)).then(
				(project) => {
					if (project.warnings.length && !warned.has(folder)) {
						warned.add(folder);

						for (const warning of project.warnings) {
							console.warn(`[plugins] ${dirName}/${folder}/${warning.path}: ${warning.message}`);
						}
					}

					return { project };
				},
				(error: unknown) => ({ error: error instanceof Error ? error.message : String(error) })
			);
			discoveries.set(folder, discovery);
		}

		return discovery;
	}

	/** Source of `virtual:pouchbase/embedded-plugins`. */
	async function pluginsModule(): Promise<string> {
		const plugins: string[] = [];
		const issues: { dir: string; message: string }[] = [];
		const found = await Promise.all(
			folders().map(async (folder) => ({ folder, discovery: await discover(folder) }))
		);

		for (const { folder, discovery } of found) {
			const dir = `/${dirName}/${folder}`;

			if ('error' in discovery) {
				issues.push({ dir, message: discovery.error });
				continue;
			}

			const { project } = discovery;
			const assets = Object.fromEntries(
				Object.entries(project.uiFiles).filter(([path]) => path.endsWith('.svg'))
			);
			const server =
				project.serverEntry === null
					? 'null'
					: `() => import(${JSON.stringify(SERVER_PREFIX + folder)})`;

			plugins.push(
				`\t{ dir: ${JSON.stringify(dir)}, manifest: ${JSON.stringify(project.manifest)}, assets: ${JSON.stringify(assets)}, server: ${server} }`
			);
		}

		return `export const plugins = [\n${plugins.join(',\n')}\n];\nexport const issues = ${JSON.stringify(issues)};\n`;
	}

	/** The folder of `plugins/` that `file` is in, or `null` when a change there doesn't matter. */
	function folderOf(file: string): string | null {
		const path = relative(pluginsDir(), file);

		if (path.startsWith('..') || resolve(pluginsDir(), path) !== resolve(file)) {
			return null;
		}

		const [folder, ...rest] = path.split(sep);

		if (!folder || !rest.length || IGNORED_DIRS.has(rest[0]!)) {
			return null;
		}

		return folder;
	}

	return {
		name: 'pouchbase:embedded-plugins',

		configResolved(config) {
			root = config.root;
		},

		buildStart() {
			discoveries.clear();
		},

		resolveId(id) {
			if (id === EMBEDDED_PLUGINS_ID) {
				return RESOLVED_ID;
			}

			if (id.startsWith(SERVER_PREFIX)) {
				return `\0${id}`;
			}

			return null;
		},

		async load(id) {
			if (id === RESOLVED_ID) {
				return pluginsModule();
			}

			if (!id.startsWith(RESOLVED_SERVER_PREFIX)) {
				return null;
			}

			const folder = id.slice(RESOLVED_SERVER_PREFIX.length);
			const discovery = await discover(folder);

			if ('error' in discovery || discovery.project.serverEntry === null) {
				return 'export default undefined;\n';
			}

			return discovery.project.serverEntry;
		},

		// A change in a plugin can change its manifest (a new folder in auth/, a label in provider.ts),
		// so the plugin is read again and both modules reload with the changed file.
		hotUpdate({ file, modules }) {
			const folder = folderOf(file);

			if (!folder) {
				return;
			}

			discoveries.delete(folder);
			warned.delete(folder);

			const graph = this.environment.moduleGraph;
			const virtual = [RESOLVED_ID, RESOLVED_SERVER_PREFIX + folder]
				.map((id) => graph.getModuleById(id))
				.filter((module): module is EnvironmentModuleNode => module !== undefined);

			if (!virtual.length) {
				return;
			}

			return [...modules, ...virtual.filter((module) => !modules.includes(module))];
		}
	};
}
