import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { addContribution } from '../src/cli/add.js';
import { addToDefinition } from '../src/cli/plugin-source.js';
import { buildBundle } from '../src/cli/project.js';
import { contributionSummary } from '../src/registry.js';
import {
	project,
	write,
	readJson,
	manifestOnlyProject,
	serverDefinition,
	useTempDir
} from './cli-helpers.js';

useTempDir();

describe('add', () => {
	it('adds a field type: its files, and its entry and import in plugin.ts', async () => {
		const root = await project('my-plugin', 'empty');
		const before = await readFile(join(root, 'pouchbase-plugin.json'), 'utf8');
		const result = await addContribution(root, 'field', 'rich_color');
		const { bundle } = await buildBundle(root);

		expect(result).toMatchObject({
			created: [
				'fields/rich_color/field.ts',
				'fields/rich_color/input.svelte',
				'fields/rich_color/preview.svelte'
			],
			changed: ['plugin.ts'],
			manifestChanged: false
		});
		expect(await readFile(join(root, 'pouchbase-plugin.json'), 'utf8')).toBe(before);
		expect(await readFile(join(root, 'plugin.ts'), 'utf8')).toContain(
			`import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import richColor from './fields/rich_color/field.js';
`
		);
		expect(await readFile(join(root, 'plugin.ts'), 'utf8')).toContain(
			`const plugin = definePlugin({
	fields: {
		rich_color: richColor
	}
});`
		);
		expect(bundle.manifest.contributes.fields).toEqual([
			{
				type: 'rich_color',
				label: 'Rich color',
				description: 'A rich color value.',
				column: 'TEXT',
				input: 'ui/fields/rich_color/input.svelte',
				preview: 'ui/fields/rich_color/preview.svelte',
				icon: 'ui/icons/lucide/text-cursor-input.svg'
			}
		]);
	});

	it('adds a page and its category to an explicit list', async () => {
		const root = await project('my-plugin', 'field');
		const result = await addContribution(root, 'page', 'reports/monthly');
		const text = await readFile(join(root, 'pouchbase-plugin.json'), 'utf8');
		const plugin = await readFile(join(root, 'plugin.ts'), 'utf8');
		const { bundle } = await buildBundle(root);

		expect(result.created).toEqual(['pages/reports/monthly.svelte']);
		expect(result.manifestChanged).toBe(true);
		expect(text).toContain('\t"categories"');
		expect(text.endsWith('}\n')).toBe(true);
		expect(plugin).toContain(
			`import color from './fields/color/field.js';
import ReportsMonthly from './pages/reports/monthly.svelte';
`
		);
		expect(plugin).toContain(
			`	pages: {
		'reports/monthly': {
			title: 'Monthly',
			icon: 'lucide:file-text',
			component: ReportsMonthly
		}
	}`
		);
		expect(bundle.manifest.categories).toEqual(['fields', 'pages']);
		expect(bundle.manifest.contributes.pages).toEqual([
			{
				path: 'reports/monthly',
				title: 'Monthly',
				component: 'ui/pages/reports/monthly.svelte',
				navigation: true,
				icon: 'ui/icons/lucide/file-text.svg'
			}
		]);
	});

	it('adds an auth provider with its icon and the example host', async () => {
		const root = await project('my-plugin', 'empty');
		const result = await addContribution(root, 'auth-provider', 'my-sso');
		const manifest = await readJson(join(root, 'pouchbase-plugin.json'));
		const { bundle } = await buildBundle(root);

		expect(result.created).toEqual(['auth/my-sso/provider.ts', 'auth/my-sso/icon.svg']);
		expect(await readFile(join(root, 'plugin.ts'), 'utf8')).toContain("'my-sso': mySso");
		expect(manifest.permissions).toEqual({ network: ['id.example.com'] });
		expect(manifest.server).toBeUndefined();
		expect(bundle.manifest.contributes.authProviders).toEqual([
			{
				id: 'my-sso',
				label: 'My sso',
				consoleUrl: 'https://id.example.com/apps',
				icon: 'ui/auth/my-sso/icon.svg'
			}
		]);
	});

	it('adds routes, with :id params, in the order they are added', async () => {
		const root = await project('my-plugin', 'empty');

		expect((await addContribution(root, 'route', 'items/:id')).created).toEqual([
			'routes/items/[id].ts'
		]);
		expect((await addContribution(root, 'route', '/')).created).toEqual(['routes/index.ts']);
		expect((await addContribution(root, 'route', 'stats')).created).toEqual(['routes/stats.ts']);
		expect(await readFile(join(root, 'plugin.ts'), 'utf8')).toContain(
			`	routes: {
		'/items/:id': itemsId,
		'/': root,
		'/stats': stats
	}`
		);

		const { routes, bundle } = await buildBundle(root);

		expect(routes).toEqual(['GET /items/:id', 'GET /', 'GET /stats']);
		expect(bundle.manifest.server).toBe('server.js');
		// The registry lists them sorted.
		expect(contributionSummary(bundle.manifest, routes).routes).toEqual([
			'GET /',
			'GET /items/:id',
			'GET /stats'
		]);

		const definition = await serverDefinition(bundle);
		const response = await definition.routes!['GET /items/:id']!(new Request('https://x.test'), {
			params: { id: '42' },
			admin: false
		} as never);

		expect(await response.json()).toEqual({
			path: '/items/:id',
			params: { id: '42' },
			admin: false
		});
	});

	it('creates plugin.ts when the plugin has none, and picks free names for imports', async () => {
		const root = await project('my-plugin', 'empty');

		await rm(join(root, 'plugin.ts'));
		expect((await addContribution(root, 'route', 'stats')).created).toEqual([
			'routes/stats.ts',
			'plugin.ts'
		]);
		await addContribution(root, 'page', 'stats');
		await addContribution(root, 'field', 'stats');

		const plugin = await readFile(join(root, 'plugin.ts'), 'utf8');

		expect(plugin).toContain("import * as stats from './routes/stats.js';");
		expect(plugin).toContain("import Stats from './pages/stats.svelte';");
		expect(plugin).toContain("import statsField from './fields/stats/field.js';");
		expect((await buildBundle(root)).routes).toEqual(['GET /stats']);
	});

	it('refuses invalid ids, existing files and ids plugin.ts has', async () => {
		const root = await project('my-plugin', 'field');

		await expect(addContribution(root, 'field', 'Bad Type')).rejects.toThrow(
			"can't be a field type"
		);
		await expect(addContribution(root, 'field', 'color')).rejects.toThrow(
			'fields in plugin.ts already has color'
		);
		await expect(addContribution(root, 'route', 'assets/logo')).rejects.toThrow(
			"can't be a route path"
		);
		await write(root, { 'pages/stats.svelte': '<p>Stats</p>\n' });
		await expect(addContribution(root, 'page', 'stats')).rejects.toThrow(
			'pages/stats.svelte already exists'
		);
		// Nothing was written for the page.
		expect(await readFile(join(root, 'plugin.ts'), 'utf8')).not.toContain('pages');
	});

	it('explains how to add an entry by hand when plugin.ts has no literal record', () => {
		expect(() =>
			addToDefinition('plugin.ts', 'export default definePlugin({ fields: shared });\n', {
				key: 'fields',
				id: 'rating',
				value: 'rating',
				imports: ["import rating from './rating.js';"]
			})
		).toThrow(
			expect.objectContaining({
				message: 'fields in plugin.ts is not an object literal',
				hint: "Add it to definePlugin({ ... }) in plugin.ts by hand: import rating from './rating.js'; fields: { rating }"
			})
		);
	});

	it('refuses a manifest with contributes or server', async () => {
		const root = await manifestOnlyProject();

		await expect(addContribution(root, 'page', 'stats')).rejects.toThrow(
			'pouchbase-plugin.json has "contributes" or "server", which are generated from plugin.ts'
		);
	});
});
