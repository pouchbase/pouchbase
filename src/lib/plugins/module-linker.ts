import { HOST_MODULES_KEY, isHostModuleId, type HostModuleId } from './host-module-ids';

/**
 * Turning the compiled UI modules of a plugin into ES modules the browser can import, without
 * `eval`: every module becomes a URL (a `blob:` URL in the browser) whose import specifiers are
 * rewritten to the URLs of the plugin's other modules and of shim modules that re-export the
 * dashboard's own host modules. Pure: the caller decides how a URL is made (`./module-loader.ts`).
 */

/** A compiled module of a plugin, as `GET /api/plugins/<id>/modules` returns it. */
export type PluginModule = {
	code: string;
	/** What the module imports; informational, the linker reads the specifiers from the code. */
	imports: string[];
};

/** All UI modules of one version of a plugin, keyed by bundle path (`ui/pages/overview.svelte`). */
export type ModuleGraph = {
	version: string;
	modules: Record<string, PluginModule>;
	/** The plugin's own stylesheets (`ui/**\/*.css`). */
	css: string[];
};

/** A plugin module that can't be linked, e.g. because it imports something that isn't there. */
export class PluginModuleError extends Error {
	override name = 'PluginModuleError';
}

/** What an import specifier of a plugin module points at. */
export type ResolvedImport = { kind: 'host'; id: HostModuleId } | { kind: 'module'; path: string };

/** `ui/pages/overview.svelte` + `../lib/stars` → `ui/lib/stars`; `null` when it leaves the bundle. */
function join(from: string, relative: string): string | null {
	const parts = from.split('/').slice(0, -1);

	for (const part of relative.split('/')) {
		if (part === '..') {
			if (!parts.length) {
				return null;
			}

			parts.pop();
		} else if (part !== '.' && part !== '') {
			parts.push(part);
		}
	}

	return parts.join('/');
}

/**
 * What `specifier`, imported by the module at `from`, refers to: a host module, or a module of the
 * plugin. Relative specifiers may leave out the extension or use `.ts` for what was compiled to
 * `.js`, as plugin authors write them.
 */
export function resolveImport(
	from: string,
	specifier: string,
	has: (path: string) => boolean
): ResolvedImport {
	if (isHostModuleId(specifier)) {
		return { kind: 'host', id: specifier };
	}

	const relative = specifier.startsWith('./') || specifier.startsWith('../');
	const base = relative
		? join(from, specifier)
		: specifier.startsWith('/')
			? specifier.slice(1)
			: specifier.startsWith('ui/')
				? specifier
				: null;

	if (base !== null) {
		const candidates = [
			base,
			base.replace(/\.ts$/, '.js'),
			`${base}.js`,
			`${base}.svelte`,
			`${base}/index.js`
		];
		const path = candidates.find(has);

		if (path) {
			return { kind: 'module', path };
		}
	}

	throw new PluginModuleError(
		base === null
			? `${from} imports "${specifier}", which the dashboard doesn't provide`
			: `${from} imports "${specifier}", which is not in the plugin`
	);
}

/** Replaces the import specifiers of `code` (positions from `es-module-lexer`). */
export async function rewriteImports(
	code: string,
	from: string,
	replace: (specifier: string) => Promise<string>
): Promise<string> {
	// Loaded on first use: it compiles WebAssembly when it loads, which only the browser may do
	// (Workers can't), and the server renders the dashboard with this module in its graph.
	const { init, parse } = await import('es-module-lexer');

	await init;

	let imports;

	try {
		[imports] = parse(code, from);
	} catch (error) {
		throw new PluginModuleError(`${from} is not a valid ES module: ${(error as Error).message}`);
	}

	const replacements: { start: number; end: number; url: string }[] = [];

	for (const entry of imports) {
		// `import.meta`.
		if (entry.d === -2) {
			continue;
		}

		if (entry.d >= 0) {
			throw new PluginModuleError(`${from} uses a dynamic import(), which plugins can't use`);
		}

		if (entry.n === undefined) {
			throw new PluginModuleError(`${from} has an import the dashboard can't read`);
		}

		replacements.push({ start: entry.s, end: entry.e, url: await replace(entry.n) });
	}

	let result = code;

	for (const { start, end, url } of replacements.sort((a, b) => b.start - a.start)) {
		result = result.slice(0, start) + url + result.slice(end);
	}

	return result;
}

/**
 * A module that re-exports a host module from the registry on `globalThis`, under every name it
 * has (`default` included). The values are read once, when the shim runs; the host modules only
 * export functions and objects, apart from bindings the compiled components don't read.
 */
export function shimCode(id: HostModuleId, names: readonly string[]): string {
	const lines = [
		`const m = globalThis[${JSON.stringify(HOST_MODULES_KEY)}].resolved[${JSON.stringify(id)}];`
	];
	const exported: string[] = [];

	names.forEach((name, index) => {
		lines.push(`const e${index} = m[${JSON.stringify(name)}];`);
		exported.push(`e${index} as ${JSON.stringify(name)}`);
	});

	if (exported.length) {
		lines.push(`export { ${exported.join(', ')} };`);
	} else {
		lines.push('export {};');
	}

	return lines.join('\n');
}

export type LinkerOptions = {
	/** Makes an importable URL for module code, e.g. a `blob:` URL. */
	createUrl(code: string): string;
	/** The URL of the shim of a host module. */
	hostUrl(id: HostModuleId): Promise<string>;
};

/**
 * Links the modules of one `ModuleGraph`, depth first, each module once: two components that import
 * the same file get the same module instance.
 */
export class ModuleLinker {
	readonly #modules: Record<string, PluginModule>;
	readonly #options: LinkerOptions;
	readonly #urls = new Map<string, Promise<string>>();

	constructor(modules: Record<string, PluginModule>, options: LinkerOptions) {
		this.#modules = modules;
		this.#options = options;
	}

	/** Whether the graph has a module at `path`. */
	has(path: string): boolean {
		return Object.hasOwn(this.#modules, path);
	}

	/** The URL to `import()` the module at `path` (a bundle path such as `ui/fields/rating/input.svelte`). */
	url(path: string): Promise<string> {
		return this.#link(path, []);
	}

	#link(path: string, chain: readonly string[]): Promise<string> {
		if (chain.includes(path)) {
			throw new PluginModuleError(
				`Circular import: ${[...chain, path].join(' → ')}; plugin modules can't import each other in a circle`
			);
		}

		let url = this.#urls.get(path);

		if (!url) {
			url = this.#build(path, [...chain, path]);
			this.#urls.set(path, url);
		}

		return url;
	}

	async #build(path: string, chain: readonly string[]): Promise<string> {
		const module = this.#modules[path];

		if (!Object.hasOwn(this.#modules, path) || !module) {
			throw new PluginModuleError(`The plugin has no module ${path}`);
		}

		const code = await rewriteImports(module.code, path, async (specifier) => {
			const target = resolveImport(path, specifier, (candidate) => this.has(candidate));

			return target.kind === 'host'
				? this.#options.hostUrl(target.id)
				: this.#link(target.path, chain);
		});

		return this.#options.createUrl(code);
	}
}

/**
 * The plugin and bundle path of a file of a built-in plugin, from its key in `import.meta.glob`:
 * `/plugins/demo/ui/overview.svelte` → `ui/overview.svelte` (the legacy layout, as is) and
 * `/plugins/demo/pages/stats.svelte` → `ui/pages/stats.svelte` (the convention folders, which the
 * bundle keeps under `ui/`).
 */
export function embeddedModulePath(key: string): { pluginId: string; path: string } | null {
	const match = /^\/plugins\/([^/]+)\/(.+)$/.exec(key);

	if (!match) {
		return null;
	}

	const [, pluginId, file] = match as unknown as [string, string, string];

	return { pluginId, path: file.startsWith('ui/') ? file : `ui/${file}` };
}
