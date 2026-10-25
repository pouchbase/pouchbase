/** Registers the Iconify icons used in `src` and `@pouchbasejs/ui`; see `@pouchbasejs/ui/vite`. */
declare module 'virtual:iconify' {}

/** The built-in plugins in `plugins/*`, read at build time; see `vite/embedded-plugins.ts`. */
declare module 'virtual:pouchbase/embedded-plugins' {
	export const plugins: import('./lib/server/plugins/embedded').EmbeddedSource[];
	export const issues: import('./lib/server/plugins/embedded').EmbeddedIssue[];
}

/** The JS SDK as one ES module, for the Worker of a plugin; see `vite/js-sdk-module.ts`. */
declare module 'virtual:pouchbase/js-sdk-module' {
	const code: string;
	export default code;
}

/** The generated server entry of a built-in plugin: default-exports what the host runs. */
declare module 'virtual:pouchbase/embedded-plugins/server/*' {
	const definition: import('@pouchbasejs/plugin-sdk/server').ServerDefinition | undefined;
	export default definition;
}
