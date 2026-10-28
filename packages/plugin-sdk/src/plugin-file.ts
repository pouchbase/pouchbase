/**
 * The files of a plugin that its server code imports but doesn't run: components and icons. Only
 * `Symbol.for` is used, so it bundles into the sandboxed server code as is.
 */

/** The key of a `PluginFile`'s path; from `Symbol.for`, so every copy of the SDK has the same one. */
export const PLUGIN_FILE: unique symbol = Symbol.for('pouchbase.plugin-file') as never;

/**
 * A file of the plugin that its server code imports but doesn't run: what an import of a
 * `.svelte` or `.svg` file is when the CLI bundles `plugin.ts`, and in tests with the Vite plugin
 * of `@pouchbasejs/plugin-sdk/vite`. `[PLUGIN_FILE]` is its path in the plugin, e.g.
 * `fields/rating/input.svelte`.
 */
export type PluginFile = { readonly [PLUGIN_FILE]: string };

/**
 * A Svelte component of the plugin with props `Props`, imported in its server code
 * (`import Stats from './stats.svelte'`): typed like the component, so its props are checked, and
 * a `PluginFile` once bundled.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PluginComponent<Props = any> =
	PluginFile | ((internals: never, props: Props) => unknown);

/** An Iconify name such as `lucide:palette`, or an imported `.svg` file. */
export type PluginIcon = string | PluginFile;

/** The path in the plugin of a `PluginFile`, e.g. `pages/stats.svelte`; `null` for anything else. */
export function pluginFilePath(value: unknown): string | null {
	if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
		return null;
	}

	const path = (value as Partial<PluginFile>)[PLUGIN_FILE];

	return typeof path === 'string' ? path : null;
}
