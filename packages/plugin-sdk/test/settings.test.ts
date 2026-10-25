import type { PluginSettings, SettingValues } from '../src/server.js';

import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { addContribution, appendSetting } from '../src/cli/add.js';
import { discoverProject } from '../src/cli/discover.js';
import { initProject } from '../src/cli/init.js';
import { buildBundle } from '../src/cli/project.js';
import { generateServerEntry, importServerCode } from '../src/cli/server-entry.js';
import { pluginFileSource, type PluginTemplate } from '../src/cli/templates.js';
import {
	createPluginSettings,
	definePlugin,
	parseSettingValue,
	type PluginSettingValue
} from '../src/server.js';

const SDK_ROOT = resolve(import.meta.dirname, '..');

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'pouchbase-plugin-settings-'));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

/** A new plugin in `dir`, with this SDK linked in as its dependency so its code bundles. */
async function project(id: string, template: PluginTemplate) {
	const { root } = await initProject(join(dir, id), { template });

	await mkdir(join(root, 'node_modules', '@pouchbasejs'), { recursive: true });
	await symlink(SDK_ROOT, join(root, 'node_modules', '@pouchbasejs', 'plugin-sdk'), 'junction');

	return root;
}

async function write(root: string, files: Record<string, string>) {
	for (const [path, contents] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), contents);
	}
}

/** `plugin.ts` with `settings` as source. */
function pluginFile(settings: string) {
	return `import { definePlugin } from '@pouchbasejs/plugin-sdk/server';\n\nexport default definePlugin({ settings: ${settings} });\n`;
}

describe('definePlugin settings types', () => {
	const plugin = definePlugin({
		settings: [
			{ key: 'greeting', label: 'Greeting', default: 'Hello' },
			{ key: 'api_key', label: 'API key', type: 'secret', required: true },
			{ key: 'limit', label: 'Limit', type: 'number' },
			{ key: 'verbose', label: 'Verbose', type: 'boolean', default: false },
			{ key: 'endpoint', label: 'Endpoint', type: 'url' }
		]
	});

	type Values = SettingValues<typeof plugin.settings>;

	it('infers literal keys and value types from the settings', () => {
		expectTypeOf<Values>().toEqualTypeOf<{
			greeting: string;
			// Required, but `null` until an admin saves it: it has no default.
			api_key: string | null;
			limit: number | null;
			verbose: boolean;
			endpoint: string | null;
		}>();
		expectTypeOf<
			PluginSettingValue<{ key: 'n'; label: 'N'; type: 'number'; required: true }>
		>().toEqualTypeOf<number | null>();
		expectTypeOf<
			PluginSettingValue<{ key: 'n'; label: 'N'; type: 'number'; required: true; default: 5 }>
		>().toEqualTypeOf<number>();
	});

	it('types get by key and refuses keys that are not declared', async () => {
		const settings = createPluginSettings(plugin.settings, {
			limit: '42'
		}) as unknown as PluginSettings<Values>;

		expectTypeOf(settings.get('limit')).resolves.toEqualTypeOf<number | null>();
		expectTypeOf(settings.get('verbose')).resolves.toEqualTypeOf<boolean>();
		expect(await settings.get('limit')).toBe(42);
		// @ts-expect-error: not a setting of the plugin
		expect(await settings.get('limits')).toBeNull();
	});

	it('falls back to any key without a registered plugin', () => {
		const settings = createPluginSettings([]);

		expectTypeOf(settings.get('anything')).resolves.toEqualTypeOf<
			string | number | boolean | null
		>();
	});
});

describe('parseSettingValue', () => {
	it('parses numbers and booleans, and keeps strings', () => {
		expect(parseSettingValue({ type: 'number' }, '42')).toBe(42);
		expect(parseSettingValue({ type: 'number' }, '-1.5')).toBe(-1.5);
		expect(parseSettingValue({ type: 'boolean' }, 'true')).toBe(true);
		expect(parseSettingValue({ type: 'boolean' }, 'false')).toBe(false);
		expect(parseSettingValue({ type: 'text' }, '42')).toBe('42');
		expect(parseSettingValue({}, 'Hello')).toBe('Hello');
		expect(parseSettingValue({ type: 'secret' }, '')).toBe('');
	});

	it('uses the default without a value, else null', () => {
		expect(parseSettingValue({ type: 'number', default: 7 }, undefined)).toBe(7);
		expect(parseSettingValue({ type: 'boolean', default: true }, null)).toBe(true);
		expect(parseSettingValue({ type: 'text' }, undefined)).toBeNull();
		expect(parseSettingValue({ type: 'number' }, 'many')).toBeNull();
		expect(parseSettingValue({ type: 'number', default: 3 }, '')).toBe(3);
	});

	it('builds ctx.settings with get and getAll', async () => {
		const settings = createPluginSettings(
			[
				{ key: 'limit', type: 'number', default: 10 },
				{ key: 'verbose', type: 'boolean' },
				{ key: 'name' }
			],
			{ verbose: 'true', other: 'x' }
		);

		expect(await settings.get('limit')).toBe(10);
		expect(await settings.get('verbose')).toBe(true);
		expect(await settings.get('name')).toBeNull();
		expect(await settings.get('other')).toBeNull();
		expect(await settings.getAll()).toEqual({ limit: 10, verbose: true, name: null });
	});
});

describe('plugin.ts', () => {
	it('puts the settings of the page template into the manifest and the server code', async () => {
		const root = await project('hello-page', 'page');
		const { bundle } = await buildBundle(root);

		expect(await readFile(join(root, 'plugin.ts'), 'utf8')).toContain(
			"declare module '@pouchbasejs/plugin-sdk/server'"
		);
		expect(bundle.manifest.settings).toEqual([
			{
				key: 'greeting',
				label: 'Greeting',
				description: 'How the Hello page greets, e.g. Hello or Welcome.',
				type: 'text',
				required: false,
				default: 'Hello'
			}
		]);

		const server = (await importServerCode(bundle.files['server.js']!)) as {
			settings: { key: string }[];
		};

		expect(server.settings.map((setting) => setting.key)).toEqual(['greeting']);
	});

	it('reads settings without other server code, and makes none', async () => {
		const root = await project('only-settings', 'empty');

		await write(root, {
			'plugin.ts': pluginFile("[{ key: 'limit', label: 'Limit', type: 'number', default: 5 }]")
		});

		const { bundle } = await buildBundle(root);

		expect(bundle.manifest.settings).toMatchObject([{ key: 'limit', type: 'number', default: 5 }]);
		expect(bundle.manifest.server).toBeUndefined();
		expect(bundle.files['server.js']).toBeUndefined();
	});

	it('checks the settings like the manifest does', async () => {
		const root = await project('bad-settings', 'empty');

		await write(root, {
			'plugin.ts': pluginFile(
				"[{ key: 'limit', label: 'Limit', type: 'number', default: 'five' }, { key: 'limit', label: 'Again' }, { key: 'Bad', label: 'Bad' }]"
			)
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: 'Problems in plugin.ts',
			issues: [
				{ path: 'plugin.ts', message: 'settings.0.default: Must be a number' },
				{
					path: 'plugin.ts',
					message: 'settings.2.key: Use lowercase letters, numbers and underscores'
				},
				{ path: 'plugin.ts', message: 'settings.1.key: Duplicate key: limit' }
			]
		});
	});

	it('is a default export, with route paths rather than the keys of the server code', async () => {
		const root = await project('bad-plugin-file', 'empty');

		await write(root, {
			'plugin.ts': "export default { settings: [], routes: { 'GET /x': () => new Response() } };\n"
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: 'plugin.ts: routes["GET /x"]: starts with a slash, e.g. /GET /x'
		});
		await write(root, { 'plugin.ts': 'export const settings = [];\n' });
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: 'plugin.ts: must default-export definePlugin({ ... })'
		});
	});

	it('refuses settings in pouchbase-plugin.json', async () => {
		const root = await project('manifest-settings', 'empty');
		const manifest = JSON.parse(await readFile(join(root, 'pouchbase-plugin.json'), 'utf8'));

		await write(root, {
			'pouchbase-plugin.json': JSON.stringify({
				...manifest,
				settings: [{ key: 'greeting', label: 'Greeting' }]
			})
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			message:
				'pouchbase-plugin.json: "settings" belong in definePlugin({ settings }) in plugin.ts',
			hint: expect.stringContaining('Move the settings to definePlugin({ settings }) in plugin.ts')
		});
	});

	it('keeps settings in the manifest in the legacy layout', async () => {
		const root = await project('legacy-settings', 'empty');

		await write(root, {
			'pouchbase-plugin.json': JSON.stringify({
				apiVersion: 1,
				id: 'legacy-settings',
				name: 'Legacy',
				settings: [{ key: 'greeting', label: 'Greeting', default: 'Hi' }],
				contributes: { pages: [{ path: 'a', title: 'A', component: 'ui/a.svelte' }] }
			}),
			'ui/a.svelte': '<p></p>\n'
		});

		const { bundle } = await buildBundle(root);

		expect(bundle.manifest.settings.map((setting) => setting.key)).toEqual(['greeting']);
	});

	it('is part of the generated server entry', () => {
		const source = generateServerEntry({ plugin: 'plugin.ts' });

		expect(source).toContain('import plugin from "./plugin.ts";');
		expect(source).toContain('settings: plugin?.settings ?? [],');
	});
});

describe('add setting', () => {
	it('creates plugin.ts with the Register block, then appends settings to it', async () => {
		const root = await project('my-plugin', 'empty');

		await rm(join(root, 'plugin.ts'));

		const first = await addContribution(root, 'setting', 'api_key', { type: 'secret' });

		expect(first).toMatchObject({ created: ['plugin.ts'], manifestChanged: false });
		expect(await readFile(join(root, 'plugin.ts'), 'utf8')).toContain('plugin: typeof plugin;');

		const second = await addContribution(root, 'setting', 'limit', { type: 'number' });
		const third = await addContribution(root, 'setting', 'verbose', { type: 'boolean' });

		expect(second).toMatchObject({ created: [], changed: ['plugin.ts'] });
		expect(third.hints[0]).toContain("await ctx.settings.get('verbose')");

		const { bundle } = await buildBundle(root);

		expect(bundle.manifest.settings).toEqual([
			{ key: 'api_key', label: 'Api key', type: 'secret', required: false },
			{ key: 'limit', label: 'Limit', type: 'number', required: false },
			{ key: 'verbose', label: 'Verbose', type: 'boolean', required: false, default: false }
		]);
	});

	it('refuses taken keys, invalid keys and unknown types', async () => {
		const root = await project('hello-page', 'page');

		await expect(addContribution(root, 'setting', 'greeting')).rejects.toThrow(
			'plugin.ts already has the setting greeting'
		);
		await expect(addContribution(root, 'setting', 'Api-Key')).rejects.toThrow(
			"can't be a setting key"
		);
		await expect(addContribution(root, 'setting', 'x', { type: 'date' })).rejects.toThrow(
			'Unknown setting type "date"'
		);
		await expect(addContribution(root, 'page', 'x', { type: 'text' })).rejects.toThrow(
			'--type is only for add setting'
		);
	});

	it('appends to a legacy manifest', async () => {
		const root = await project('legacy', 'empty');

		await write(root, {
			'pouchbase-plugin.json': JSON.stringify({ apiVersion: 1, id: 'legacy', contributes: {} })
		});

		const result = await addContribution(root, 'setting', 'region');
		const manifest = JSON.parse(await readFile(join(root, 'pouchbase-plugin.json'), 'utf8'));

		expect(result).toMatchObject({ layout: 'legacy', manifestChanged: true });
		expect(manifest.settings).toEqual([{ key: 'region', label: 'Region', type: 'text' }]);
	});

	it('adds settings to definePlugin calls without any', () => {
		const setting = { key: 'region', label: 'Region', type: 'text' } as const;

		expect(appendSetting('plugin.ts', 'export default definePlugin({});\n', setting)).toBe(
			"export default definePlugin({\n\tsettings: [\n\t\t{\n\t\t\tkey: 'region',\n\t\t\tlabel: 'Region',\n\t\t\ttype: 'text'\n\t\t}\n\t]\n});\n"
		);
		expect(appendSetting('plugin.ts', pluginFileSource([]), setting)).toContain(
			"\tsettings: [\n\t\t{\n\t\t\tkey: 'region',"
		);
		expect(() => appendSetting('plugin.ts', 'export default {};\n', setting)).toThrow(
			'plugin.ts has no definePlugin({ ... }) call'
		);
	});
});

describe('UI imports', () => {
	it('refuses .css, .json and .svg imports, which the host does not link', async () => {
		const root = await project('my-plugin', 'field');

		await write(root, {
			'fields/color/style.css': 'span { color: red; }\n',
			'fields/color/data.json': '{}\n',
			'fields/color/preview.svelte': `<script lang="ts">
	import './style.css';
	import data from './data.json';
</script>

{JSON.stringify(data)}
`
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: 'Problems in the UI files',
			issues: [
				{
					path: 'fields/color/preview.svelte',
					message: 'imports ./style.css; UI files may only import .svelte, .ts and .js files'
				},
				{
					path: 'fields/color/preview.svelte',
					message: 'imports ./data.json; UI files may only import .svelte, .ts and .js files'
				}
			],
			hint: expect.stringContaining('<style> block')
		});
	});

	it('refuses them in the legacy layout too', async () => {
		const root = await project('legacy-ui', 'empty');

		await write(root, {
			'pouchbase-plugin.json': JSON.stringify({
				apiVersion: 1,
				id: 'legacy-ui',
				name: 'Legacy',
				contributes: { pages: [{ path: 'a', title: 'A', component: 'ui/a.svelte' }] }
			}),
			'ui/a.svelte': "<script>\n\timport './a.css';\n\timport logo from './logo.svg';\n</script>\n",
			'ui/a.css': 'p { color: red; }\n',
			'ui/logo.svg': '<svg></svg>\n'
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			issues: [
				{
					path: 'ui/a.svelte',
					message: expect.stringContaining('Imports ./a.css; every .css file')
				},
				{
					path: 'ui/a.svelte',
					message: expect.stringContaining('Imports ./logo.svg; UI files may only import')
				}
			]
		});
	});
});
