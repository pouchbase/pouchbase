/**
 * Types of the imports a plugin's server code may have besides modules: `.svg` icons, which the
 * CLI turns into a `PluginFile`. Add it to `compilerOptions.types` in `tsconfig.json`:
 * `"types": ["svelte", "@pouchbasejs/plugin-sdk/env"]` (`svelte` types `.svelte` imports).
 */
declare module '*.svg' {
	const icon: import('@pouchbasejs/plugin-sdk/server').PluginFile;
	export default icon;
}
