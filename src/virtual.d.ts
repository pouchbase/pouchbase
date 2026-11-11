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

/** The entry of a function's Worker, bundled with the JS SDK; see `vite/function-worker.ts`. */
declare module 'virtual:pouchbase/function-worker' {
	export const entry: string;
}

/** The JS SDK's declarations for the functions editor; see `vite/function-worker.ts`. */
declare module 'virtual:pouchbase/function-typings' {
	export const sdkTypings: string;
}

/** The generated server entry of a built-in plugin: default-exports what the host runs. */
declare module 'virtual:pouchbase/embedded-plugins/server/*' {
	const definition: import('@pouchbasejs/plugin-sdk/server').ServerDefinition | undefined;
	export default definition;
}
