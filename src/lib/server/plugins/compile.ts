import { UI_DIR, compileUi as compileUiWith } from '@pouchbasejs/plugin-sdk';

/**
 * Compiling the UI of a plugin for the dashboard, on install, with the dashboard's own Svelte
 * compiler (loaded only when a plugin is installed). The rules (which imports a UI file may have,
 * how relative specifiers become bundle paths) live in the plugin SDK's `compileUi`, so
 * `pouchbase-plugin validate` checks exactly what this accepts.
 */

export {
	formatCompileIssue,
	resolveRelative,
	type CompiledModule,
	type CompileIssue,
	type CompiledUi
} from '@pouchbasejs/plugin-sdk';

type SvelteCompiler = typeof import('svelte/compiler');

let compiler: Promise<SvelteCompiler> | undefined;

/** The Svelte compiler, imported on first use so it stays out of the Worker's startup. */
function loadCompiler(): Promise<SvelteCompiler> {
	compiler ??= import('svelte/compiler').catch((error: unknown) => {
		compiler = undefined;

		throw error;
	});

	return compiler;
}

/**
 * Compiles the `ui/` files of a bundle (`files`: bundle path → contents; other files are
 * ignored). The UI can only be installed when `issues` is empty.
 */
export async function compileUi(files: Readonly<Record<string, string>>) {
	const svelte = Object.keys(files).some(
		(path) => path.startsWith(`${UI_DIR}/`) && path.endsWith('.svelte')
	)
		? await loadCompiler()
		: null;

	return compileUiWith(files, svelte);
}
