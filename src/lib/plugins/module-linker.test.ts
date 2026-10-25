import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

import { HOST_MODULE_IDS, HOST_MODULES_KEY, type HostModuleId } from './host-module-ids';
import {
	embeddedModulePath,
	ModuleLinker,
	PluginModuleError,
	resolveImport,
	rewriteImports,
	shimCode,
	type PluginModule
} from './module-linker';

function dataUrl(code: string) {
	return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}

function decode(url: string) {
	return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64').toString();
}

function modules(entries: Record<string, string>): Record<string, PluginModule> {
	return Object.fromEntries(
		Object.entries(entries).map(([path, code]) => [path, { code, imports: [] }])
	);
}

/** A linker over `data:` URLs, with shims over the given host namespaces. */
function linker(
	entries: Record<string, PluginModule>,
	host: Partial<Record<HostModuleId, Record<string, unknown>>> = {}
) {
	(globalThis as Record<string, unknown>)[HOST_MODULES_KEY] = { resolved: host, load: () => {} };

	const created: string[] = [];
	const instance = new ModuleLinker(entries, {
		createUrl(code) {
			created.push(code);

			return dataUrl(code);
		},
		async hostUrl(id) {
			const namespace = host[id];

			if (!namespace) {
				throw new Error(`No host module ${id}`);
			}

			return dataUrl(shimCode(id, Object.keys(namespace)));
		}
	});

	return { instance, created };
}

describe('resolveImport', () => {
	const has = (path: string) =>
		['ui/lib/stars.js', 'ui/pages/chart.svelte', 'ui/rating.js'].includes(path);

	it('knows every host module', () => {
		for (const id of HOST_MODULE_IDS) {
			expect(resolveImport('ui/a.svelte', id, has)).toEqual({ kind: 'host', id });
		}
	});

	it('resolves relative imports against the importing module', () => {
		expect(resolveImport('ui/pages/overview.svelte', './chart.svelte', has)).toEqual({
			kind: 'module',
			path: 'ui/pages/chart.svelte'
		});
		expect(resolveImport('ui/pages/overview.svelte', '../lib/stars.js', has)).toEqual({
			kind: 'module',
			path: 'ui/lib/stars.js'
		});
	});

	it('accepts what plugin authors write for compiled TypeScript', () => {
		expect(resolveImport('ui/pages/overview.svelte', '../lib/stars', has)).toMatchObject({
			path: 'ui/lib/stars.js'
		});
		expect(resolveImport('ui/pages/overview.svelte', '../lib/stars.ts', has)).toMatchObject({
			path: 'ui/lib/stars.js'
		});
		expect(resolveImport('ui/rating-input.svelte', './rating.js', has)).toMatchObject({
			path: 'ui/rating.js'
		});
	});

	it('takes bundle paths as they are', () => {
		expect(resolveImport('ui/a.svelte', 'ui/lib/stars.js', has)).toMatchObject({
			path: 'ui/lib/stars.js'
		});
		expect(resolveImport('ui/a.svelte', '/ui/lib/stars.js', has)).toMatchObject({
			path: 'ui/lib/stars.js'
		});
	});

	it('refuses other packages, missing files and paths outside the bundle', () => {
		expect(() => resolveImport('ui/a.svelte', 'lodash', has)).toThrow(/doesn't provide/);
		expect(() => resolveImport('ui/a.svelte', 'svelte/internal/server', has)).toThrow(
			PluginModuleError
		);
		expect(() => resolveImport('ui/a.svelte', './missing.js', has)).toThrow(/not in the plugin/);
		expect(() => resolveImport('ui/a.svelte', '../../secret.js', has)).toThrow(PluginModuleError);
	});
});

describe('rewriteImports', () => {
	it('replaces static imports and re-exports, keeping the rest', async () => {
		const code = [
			"import 'svelte/internal/disclose-version';",
			"import * as $ from 'svelte/internal/client';",
			'import { a } from "./a.js";',
			"export * from './b.js';",
			'const url = import.meta.url;'
		].join('\n');

		const rewritten = await rewriteImports(code, 'ui/x.js', async (specifier) => `X<${specifier}>`);

		expect(rewritten).toBe(
			[
				"import 'X<svelte/internal/disclose-version>';",
				"import * as $ from 'X<svelte/internal/client>';",
				'import { a } from "X<./a.js>";',
				"export * from 'X<./b.js>';",
				'const url = import.meta.url;'
			].join('\n')
		);
	});

	it('refuses dynamic imports', async () => {
		await expect(
			rewriteImports("const m = await import('./a.js');", 'ui/x.js', async (s) => s)
		).rejects.toThrow(/dynamic import/);
	});

	it('reports code that is not a module', async () => {
		await expect(rewriteImports('import {', 'ui/x.js', async (s) => s)).rejects.toThrow(
			/not a valid ES module/
		);
	});
});

describe('shimCode', () => {
	it('re-exports every name of the registry entry, default included', async () => {
		const mount = () => {};
		const helper = () => {};
		const host = { svelte: { mount, default: helper, 'odd-name': 1 } };

		(globalThis as Record<string, unknown>)[HOST_MODULES_KEY] = { resolved: host };

		const shim = await import(
			/* @vite-ignore */ dataUrl(shimCode('svelte', Object.keys(host.svelte)))
		);

		expect(shim.mount).toBe(mount);
		expect(shim.default).toBe(helper);
		expect(shim['odd-name']).toBe(1);
	});

	it('works for a module without exports', async () => {
		(globalThis as Record<string, unknown>)[HOST_MODULES_KEY] = {
			resolved: { 'svelte/internal/disclose-version': {} }
		};

		const shim = await import(
			/* @vite-ignore */ dataUrl(shimCode('svelte/internal/disclose-version', []))
		);

		expect(Object.keys(shim)).toEqual([]);
	});
});

describe('ModuleLinker', () => {
	it('links a graph depth first and shares modules between importers', async () => {
		const { instance, created } = linker(
			modules({
				'ui/a.js': "import { count } from './shared.js'; export default () => count();",
				'ui/b.js': "import { count } from './shared.js'; export default () => count();",
				'ui/shared.js': 'let n = 0; export function count() { return ++n; }'
			})
		);

		const a = await import(/* @vite-ignore */ await instance.url('ui/a.js'));
		const b = await import(/* @vite-ignore */ await instance.url('ui/b.js'));

		// One instance of `shared.js`: the counter goes on.
		expect(a.default()).toBe(1);
		expect(b.default()).toBe(2);
		expect(created).toHaveLength(3);
		expect(await instance.url('ui/a.js')).toBe(await instance.url('ui/a.js'));
	});

	it('refuses circular imports', async () => {
		const { instance } = linker(
			modules({
				'ui/a.js': "import './b.js';",
				'ui/b.js': "import './a.js';"
			})
		);

		await expect(instance.url('ui/a.js')).rejects.toThrow(/Circular import: ui\/a.js → ui\/b.js/);
	});

	it('fails for a module that is not in the graph', async () => {
		const { instance } = linker(modules({}));

		await expect(instance.url('ui/nope.svelte')).rejects.toThrow(/no module ui\/nope.svelte/);
	});

	it('links a compiled Svelte component to the host runtime', async () => {
		const source = [
			'<script>',
			"\timport { getContext } from 'svelte';",
			"\timport { stars } from './stars.js';",
			'\tlet { value } = $props();',
			"\tconst theme = getContext('theme');",
			'</script>',
			'',
			'<span class={theme}>{stars(value)}</span>',
			'',
			'<style>span { color: red; }</style>'
		].join('\n');
		const { js } = compile(source, {
			generate: 'client',
			runes: true,
			css: 'injected',
			filename: 'preview.svelte',
			dev: false
		});

		// Stand-ins for the dashboard's modules: what matters is that the component gets exactly
		// these objects.
		const client = Object.fromEntries(
			['push', 'pop', 'from_html', 'append_styles', 'template_effect', 'set_class', 'set_text']
				.concat(
					[...js.code.matchAll(/\$\.([a-z_]+)/g)].map((match) => match[1] ?? '').filter(Boolean)
				)
				.map((name) => [name, () => {}])
		);
		const svelte = { getContext: () => {} };
		const { instance, created } = linker(
			modules({
				'ui/fields/rating/preview.svelte': js.code,
				'ui/fields/rating/stars.js': 'export function stars(n) { return "★".repeat(n); }'
			}),
			{
				svelte,
				'svelte/internal/client': client,
				'svelte/internal/disclose-version': {}
			}
		);

		const url = await instance.url('ui/fields/rating/preview.svelte');
		const component = await import(/* @vite-ignore */ url);

		expect(typeof component.default).toBe('function');
		expect(decode(url)).not.toMatch(/from ['"](svelte|\.\/)/);
		expect(created).toHaveLength(2);

		// The shim hands out the registry's own function objects.
		const shim = await import(
			/* @vite-ignore */ dataUrl(shimCode('svelte/internal/client', Object.keys(client)))
		);

		expect(shim.push).toBe(client.push);
	});
});

describe('embeddedModulePath', () => {
	it('maps legacy ui/ files as they are', () => {
		expect(embeddedModulePath('/plugins/demo/ui/overview-page.svelte')).toEqual({
			pluginId: 'demo',
			path: 'ui/overview-page.svelte'
		});
	});

	it('maps other files of the plugin under ui/', () => {
		expect(embeddedModulePath('/plugins/demo/fields/rating/input.svelte')).toEqual({
			pluginId: 'demo',
			path: 'ui/fields/rating/input.svelte'
		});
		expect(embeddedModulePath('/plugins/demo/pages/stats/daily.svelte')).toEqual({
			pluginId: 'demo',
			path: 'ui/pages/stats/daily.svelte'
		});
	});

	it('ignores other keys', () => {
		expect(embeddedModulePath('/src/lib/a.svelte')).toBeNull();
	});
});
