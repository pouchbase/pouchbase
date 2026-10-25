import { existsSync } from 'node:fs';
import { dirname, posix, resolve, sep } from 'node:path';

/**
 * Imports of components and images in a plugin's server code. `plugin.ts` imports the `.svelte`
 * and `.svg` files it names (`import Stats from './pages/stats.svelte'`), but the server code never
 * runs them: each becomes a `PluginFile`, an object with the file's path in the plugin under
 * `Symbol.for('pouchbase.plugin-file')`. The CLI reads those paths to build the manifest and
 * compiles the components for the dashboard itself.
 *
 * The plugin works with Rolldown (the CLI's bundler) and Vite (vitest, and the Vite plugin that
 * embeds Pouchbase's built-in plugins), whose `resolveId` and `load` hooks are the same. This module
 * imports nothing but Node.js, so Node.js can load it from the sources, as Vite loads a config.
 */

/** The imports that become a `PluginFile`. */
export const PLUGIN_FILE_IMPORT = /\.(?:svelte|svg)$/;

/** Prefix of the ids the plugin resolves them to; `\0` keeps other plugins away from them. */
const PREFIX = '\0pouchbase-plugin-file:';

/** The absolute path of the file an id of `pluginFiles()` stands for; `null` for other ids. */
export function pluginFileOfId(id: string): string | null {
	return id.startsWith(PREFIX) ? id.slice(PREFIX.length) : null;
}

export type PluginFilesOptions = {
	/** The plugin's directory: the paths of the `PluginFile`s are relative to it. */
	root: string;
	/** Whether to handle the imports of `importer`; default every importer. */
	include?: (importer: string) => boolean;
};

/** The hooks of the plugin, typed loosely enough for both Rolldown and Vite. */
export type PluginFilesPlugin = {
	name: string;
	enforce: 'pre';
	resolveId(source: string, importer: string | undefined): string | null;
	load(id: string): string | null;
};

function toPosix(path: string) {
	return path.split(sep).join('/');
}

/** Whether a path relative to the plugin is outside it. */
function isOutside(path: string) {
	return path === '..' || path.startsWith('../') || posix.isAbsolute(path);
}

/** `./stats.svelte?v=1` → `./stats.svelte`. */
function withoutQuery(id: string) {
	const query = id.indexOf('?');

	return query === -1 ? id : id.slice(0, query);
}

export function pluginFiles(options: PluginFilesOptions): PluginFilesPlugin {
	const root = toPosix(resolve(options.root));

	return {
		name: 'pouchbase-plugin-files',
		enforce: 'pre',
		resolveId(source, importer) {
			if (!importer || !source.startsWith('.') || !PLUGIN_FILE_IMPORT.test(source)) {
				return null;
			}

			const from = withoutQuery(importer);

			if (from.startsWith('\0') || (options.include && !options.include(from))) {
				return null;
			}

			const file = toPosix(resolve(dirname(from), source));

			if (isOutside(posix.relative(root, file))) {
				throw new Error(`${from} imports ${source}, which is outside the plugin`);
			}

			return PREFIX + file;
		},
		load(id) {
			if (!id.startsWith(PREFIX)) {
				return null;
			}

			const file = id.slice(PREFIX.length);
			const path = posix.relative(root, file);

			// Another plugin's file, when several plugins are bundled together.
			if (isOutside(path)) {
				return null;
			}

			if (!existsSync(file)) {
				throw new Error(`${path} doesn't exist`);
			}

			return `export default { [Symbol.for('pouchbase.plugin-file')]: ${JSON.stringify(path)} };\n`;
		}
	};
}

// Vite

/**
 * The Vite plugin for the tests of a plugin: `plugin.ts` and the files it imports may import
 * `.svelte` components and `.svg` icons, which vitest can't run on its own. With this plugin they
 * are what they are when the CLI builds the plugin: a `PluginFile`, the file's path in the plugin.
 *
 * ```ts
 * // vitest.config.ts
 * import { pouchbasePlugin } from '@pouchbasejs/plugin-sdk/vite';
 * import { defineConfig } from 'vitest/config';
 *
 * export default defineConfig({ plugins: [pouchbasePlugin()] });
 * ```
 */

export type PouchbasePluginOptions = {
	/** The plugin's directory; default Vite's `root`. */
	root?: string;
};

/** The hooks of the plugin; a Vite `Plugin` without depending on Vite's types. */
export type PouchbaseVitePlugin = PluginFilesPlugin & {
	configResolved(config: { root: string }): void;
};

export function pouchbasePlugin(options: PouchbasePluginOptions = {}): PouchbaseVitePlugin {
	let files = pluginFiles({ root: options.root ?? process.cwd() });

	return {
		name: 'pouchbase-plugin',
		enforce: 'pre',
		configResolved(config) {
			files = pluginFiles({ root: options.root ?? config.root });
		},
		resolveId(source, importer) {
			return files.resolveId(source, importer);
		},
		load(id) {
			return files.load(id);
		}
	};
}
