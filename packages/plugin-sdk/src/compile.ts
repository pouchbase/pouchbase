// The JavaScript build (synchronous, no `init`): the default one compiles WebAssembly at runtime,
// which Workers don't allow.
import { parse } from 'es-module-lexer/js';

import { UI_DIR } from './manifest.js';
import { HOST_MODULE_IDS } from './ui.js';

/**
 * Compiling the UI of a plugin for the dashboard: what a host does on install, and what
 * `pouchbase-plugin validate`, `build` and `dev` do with the plugin's own Svelte compiler, so both
 * apply the same rules. Every `ui/**\/*.svelte` file of the bundle becomes a client-side ES module,
 * `ui/**\/*.js` files are kept as they are, and `ui/**\/*.css` files are collected so the dashboard
 * injects them once.
 *
 * The browser runs the modules from `blob:` URLs, so every import must be something the host can
 * map: a module the dashboard provides (exactly one of `HOST_MODULE_IDS`) or another
 * `.svelte`/`.js` file in the plugin's `ui/` directory. Relative specifiers are rewritten to bundle
 * paths (`./stars.js` in `ui/fields/rating.svelte` becomes `ui/fields/stars.js`), in the code and
 * in `imports`, so the loader never resolves paths itself. Dynamic `import()` is rejected: the
 * loader can't see what it loads.
 */

/** A compiled module of a plugin: ES module code and the specifiers it imports. */
export type CompiledModule = {
	code: string;
	/** Host module ids and bundle paths (`ui/stars.js`), in the order the code imports them. */
	imports: string[];
};

/** A problem with a UI file; `line` and `column` (1-based) are in the source file. */
export type CompileIssue = { path: string; message: string; line?: number; column?: number };

export type CompiledUi = {
	/** Bundle path (`ui/pages/overview.svelte`) → module; `.svelte` files keep their path. */
	modules: Record<string, CompiledModule>;
	/** Bundle path → contents of every `.css` file in `ui/`. */
	css: Record<string, string>;
	issues: CompileIssue[];
};

/** The options a host compiles every component with. */
export const SVELTE_COMPILE_OPTIONS = {
	generate: 'client',
	runes: true,
	css: 'injected',
	dev: false
} as const;

/** The part of `svelte/compiler` that `compileUi` uses. */
export type SvelteCompiler = {
	compile(
		source: string,
		options: typeof SVELTE_COMPILE_OPTIONS & { filename: string }
	): { js: { code: string } };
};

const HOST_IDS: ReadonlySet<string> = new Set(HOST_MODULE_IDS);

/** Files of `ui/` that the browser runs as modules. */
const MODULE_FILE = /\.(?:svelte|js)$/;

/** `es-module-lexer` import types that are allowed: static imports and `import.meta`. */
const STATIC_IMPORT = 1;
const IMPORT_META = 3;

/** The 1-based line and column of `offset` in `text`. */
function position(text: string, offset: number): { line: number; column: number } {
	const before = text.slice(0, Math.max(0, offset));
	const line = before.split('\n').length;

	return { line, column: offset - before.lastIndexOf('\n') };
}

/** Where `specifier` is written in `source`, as a quoted string; `{}` when it isn't found. */
function specifierPosition(source: string, specifier: string): { line?: number; column?: number } {
	for (const quote of ["'", '"', '`']) {
		const index = source.indexOf(`${quote}${specifier}${quote}`);

		if (index !== -1) {
			return position(source, index + 1);
		}
	}

	return {};
}

/**
 * The bundle path a relative `specifier` of the file at `from` points to, or `null` when it leaves
 * the `ui/` directory.
 */
export function resolveRelative(from: string, specifier: string): string | null {
	const parts = from.split('/').slice(0, -1);

	for (const segment of specifier.split('/')) {
		if (segment === '.' || segment === '') {
			continue;
		}

		if (segment === '..') {
			if (parts.length <= 1) {
				return null;
			}

			parts.pop();
		} else {
			parts.push(segment);
		}
	}

	const path = parts.join('/');

	return parts[0] === UI_DIR && parts.length > 1 ? path : null;
}

function isRelative(specifier: string) {
	return specifier.startsWith('./') || specifier.startsWith('../');
}

/** The message of a Svelte compile error, without the link to the docs Svelte appends. */
function compileMessage(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);

	return message.replace(/\nhttps:\/\/svelte\.dev\/e\/\S+\s*$/, '').trim();
}

/**
 * Checks and rewrites the imports of a module: `code` is what runs, `source` what the author
 * wrote (the same for `.js` files), for the positions of the issues.
 */
function linkModule(
	path: string,
	code: string,
	source: string,
	files: Readonly<Record<string, string>>
): { module: CompiledModule; issues: CompileIssue[] } {
	const issues: CompileIssue[] = [];
	let imports: ReturnType<typeof parse>[0];

	try {
		[imports] = parse(code, path);
	} catch (error) {
		const index = (error as { idx?: unknown }).idx;

		return {
			module: { code, imports: [] },
			issues: [
				{
					path,
					message: 'The module could not be parsed',
					...(typeof index === 'number' && code === source ? position(source, index) : {})
				}
			]
		};
	}

	const resolved: string[] = [];
	const rewrites: { start: number; end: number; value: string }[] = [];

	for (const entry of imports) {
		if (entry.t === IMPORT_META) {
			continue;
		}

		const where =
			code === source
				? position(source, entry.s)
				: entry.n
					? specifierPosition(source, entry.n)
					: {};

		if (entry.t !== STATIC_IMPORT) {
			issues.push({
				path,
				message: 'Dynamic import() is not allowed; import the module statically',
				...where
			});
			continue;
		}

		const specifier = entry.n;

		if (!specifier) {
			continue;
		}

		if (HOST_IDS.has(specifier)) {
			resolved.push(specifier);
			continue;
		}

		if (!isRelative(specifier)) {
			issues.push({
				path,
				message: `Cannot import ${specifier}: only modules Pouchbase provides and files in ${UI_DIR}/ can be imported`,
				...where
			});
			continue;
		}

		const target = resolveRelative(path, specifier);

		if (!target) {
			issues.push({
				path,
				message: `Cannot import ${specifier}: it is outside the ${UI_DIR}/ directory`,
				...where
			});
			continue;
		}

		if (!MODULE_FILE.test(target)) {
			issues.push({
				path,
				message: target.endsWith('.css')
					? `Cannot import ${specifier}: every .css file in ${UI_DIR}/ is loaded with the plugin`
					: `Cannot import ${specifier}: only .svelte and .js files can be imported`,
				...where
			});
			continue;
		}

		if (!Object.hasOwn(files, target)) {
			issues.push({
				path,
				message: `Cannot import ${specifier}: ${target} does not exist`,
				...where
			});
			continue;
		}

		resolved.push(target);
		rewrites.push({ start: entry.s, end: entry.e, value: target });
	}

	let linked = code;

	for (const rewrite of rewrites.sort((a, b) => b.start - a.start)) {
		linked = `${linked.slice(0, rewrite.start)}${rewrite.value}${linked.slice(rewrite.end)}`;
	}

	return { module: { code: linked, imports: [...new Set(resolved)] }, issues };
}

/**
 * Compiles the `ui/` files of a bundle (`files`: bundle path → contents; other files are
 * ignored) with `svelte`, the `svelte/compiler` module. The UI can only be installed when
 * `issues` is empty. Without a compiler (`null`), `.svelte` files are left out and only the `.js`
 * files are checked.
 */
export function compileUi(
	files: Readonly<Record<string, string>>,
	svelte: SvelteCompiler | null
): CompiledUi {
	const paths = Object.keys(files)
		.filter((path) => path.startsWith(`${UI_DIR}/`))
		.sort();
	const modules: Record<string, CompiledModule> = {};
	const css: Record<string, string> = {};
	const issues: CompileIssue[] = [];

	for (const path of paths) {
		const source = files[path]!;

		if (path.endsWith('.css')) {
			css[path] = source;
			continue;
		}

		if (path.endsWith('.js')) {
			const linked = linkModule(path, source, source, files);

			modules[path] = linked.module;
			issues.push(...linked.issues);
			continue;
		}

		if (!path.endsWith('.svelte') || !svelte) {
			continue;
		}

		let code: string;

		try {
			code = svelte.compile(source, { filename: path, ...SVELTE_COMPILE_OPTIONS }).js.code;
		} catch (error) {
			const start = (error as { start?: { line?: unknown; column?: unknown } }).start;

			issues.push({
				path,
				message: compileMessage(error),
				...(typeof start?.line === 'number' ? { line: start.line } : {}),
				// Svelte's columns are 0-based.
				...(typeof start?.column === 'number' ? { column: start.column + 1 } : {})
			});
			continue;
		}

		const linked = linkModule(path, code, source, files);

		modules[path] = linked.module;
		issues.push(...linked.issues);
	}

	return { modules, css, issues };
}

/** `ui/rating.svelte:4:9: Unexpected token`, for logs and messages. */
export function formatCompileIssue(issue: CompileIssue) {
	const where = [issue.path, issue.line, issue.line ? issue.column : undefined]
		.filter((part) => part !== undefined)
		.join(':');

	return `${where}: ${issue.message}`;
}
