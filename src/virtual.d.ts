/** Registers the Iconify icons used in `src` and `@pouchbasejs/ui`; see `@pouchbasejs/ui/vite`. */
declare module 'virtual:iconify' {}

/** The built-in plugins in `plugins/*`, read at build time; see `vite/embedded-plugins.ts`. */
declare module 'virtual:pouchbase/embedded-plugins' {
	export const plugins: import('./lib/server/plugins/embedded').EmbeddedSource[];
	export const issues: import('./lib/server/plugins/embedded').EmbeddedIssue[];
}

/** The generated server entry of a built-in plugin: default-exports `definePlugin(...)`'s input. */
declare module 'virtual:pouchbase/embedded-plugins/server/*' {
	const definition: import('@pouchbasejs/plugin-sdk/server').PluginDefinition | undefined;
	export default definition;
}
