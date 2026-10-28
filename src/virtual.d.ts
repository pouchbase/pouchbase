/** Registers the Iconify icons used in `src` and `@pouchbasejs/ui`; see `@pouchbasejs/ui/vite`. */
declare module 'virtual:iconify' {}

/** The built-in plugins in `plugins/*`, read at build time; see `vite/embedded-plugins.ts`. */
declare module 'virtual:pouchbase/embedded-plugins' {
	export const plugins: import('./lib/server/plugins/embedded').EmbeddedSource[];
	export const issues: import('./lib/server/plugins/embedded').EmbeddedIssue[];
}

/** The modules of a plugin's Worker that every plugin shares, bundled; see `vite/plugin-worker.ts`. */
declare module 'virtual:pouchbase/plugin-worker' {
	export const entry: string;
	export const guard: string;
}

/** The generated server entry of a built-in plugin: default-exports what the host runs. */
declare module 'virtual:pouchbase/embedded-plugins/server/*' {
	const definition: import('@pouchbasejs/plugin-sdk/server').ServerDefinition | undefined;
	export default definition;
}
