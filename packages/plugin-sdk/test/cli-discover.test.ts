import { rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	discoverProject,
	routeFileFor,
	routePathFor,
	routePathProblem
} from '../src/cli/discover/index.js';
import { buildBundle } from '../src/cli/project.js';
import {
	DEMO_ROOT,
	project,
	write,
	capture,
	manifestOnlyProject,
	pluginFile,
	useTempDir
} from './cli-helpers.js';

useTempDir();

describe('discoverProject', () => {
	it('builds the demo plugin', async () => {
		const { bundle, routes } = await buildBundle(DEMO_ROOT);

		expect(bundle.manifest.contributes.fields.map((field) => field.type)).toEqual([
			'color',
			'phone',
			'rating'
		]);
		expect(bundle.manifest.contributes.fields).toContainEqual({
			type: 'rating',
			label: 'Rating',
			description: 'A whole number of stars, from 1 to 5.',
			column: 'INTEGER',
			input: 'ui/fields/rating/input.svelte',
			preview: 'ui/fields/rating/preview.svelte',
			icon: 'ui/icons/lucide/star-half.svg'
		});
		expect(bundle.manifest.contributes).toMatchObject({
			// In the order of plugin.ts.
			pages: [
				{
					path: 'overview',
					title: 'Demo',
					component: 'ui/pages/overview.svelte',
					navigation: true,
					icon: 'ui/icons/lucide/layout-dashboard.svg'
				},
				{ path: 'fields', title: 'Field playground', icon: 'ui/icons/lucide/shapes.svg' },
				{ path: 'api', title: 'API explorer', icon: 'ui/icons/lucide/terminal.svg' }
			],
			authProviders: [],
			collections: [
				{
					name: 'notes',
					fields: [
						{ name: 'text', type: 'text', required: true },
						{ name: 'author', type: 'relation', options: { collection: 'users' } }
					],
					indexes: [{ columns: ['author'], unique: false }]
				}
			]
		});
		expect(bundle.manifest.permissions.collections).toEqual({ read: ['users'], write: [] });
		expect(routes.sort()).toEqual([
			'GET /github-status',
			'GET /info',
			'GET /items/:id',
			'GET /me',
			'GET /notes',
			'POST /echo',
			'POST /notes'
		]);
		expect(bundle.files['ui/icons/lucide/pipette.svg']).toContain('<svg');
		expect(bundle.manifest.settings.map((setting) => setting.key)).toEqual([
			'greeting',
			'max_length',
			'shout'
		]);
		expect(bundle.files['ui/lib/rating.js']).toContain('MAX_RATING');
		expect(bundle.files['ui/lib/rating.ts']).toBeUndefined();
	});

	it('accepts a relative root', async () => {
		const root = await project('hello-page', 'page');
		const found = await discoverProject(relative(process.cwd(), root));

		expect(found.routes).toEqual(['GET /hello']);
	});

	it('logs what it found', async () => {
		const root = await project('hello-page', 'page');
		const { log, stdout } = capture();

		await buildBundle(root, { log });

		expect(stdout).toContain('  Found 1 page (hello), 1 route (GET /hello), 1 setting (greeting)');
		expect(stdout).toContain('› Reading plugin.ts');
		expect(stdout).toContain('  1 page, 1 route, 1 setting');
		expect(stdout[0]).toBe('› Reading pouchbase-plugin.json');
	});

	it('needs plugin.ts, with a definition', async () => {
		const root = await project('my-plugin', 'empty');

		await write(root, { 'plugin.ts': 'export const x = 1;\n' });
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: 'plugin.ts: must default-export definePlugin({ ... })'
		});
		await rm(join(root, 'plugin.ts'));
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: expect.stringMatching(/^plugin\.ts: doesn't exist/)
		});
	});

	it('needs an input, a description and a column for every field type', async () => {
		const root = await project('my-plugin', 'empty');

		await write(root, {
			'rating.svelte': '<input />\n',
			'plugin.ts': pluginFile(
				"import Input from './rating.svelte';\n",
				"{ fields: { rating: { label: 'Rating', input: Input }, stars: { label: 'Stars' }, Bad: {} }, extra: {} } as never"
			)
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: 'Problems in plugin.ts',
			issues: [
				{
					path: 'plugin.ts',
					message:
						"definePlugin({ extra }) isn't something a plugin adds; use settings, fields, pages, authProviders, collections, routes, functions"
				},
				{
					path: 'plugin.ts',
					message:
						'fields.rating needs a description: one sentence shown when an admin picks the type'
				},
				{
					path: 'plugin.ts',
					message:
						'fields.rating needs a column: TEXT, INTEGER, REAL or BLOB, the storage class of the value'
				},
				{
					path: 'plugin.ts',
					message:
						"fields.stars.input is missing: a Svelte component of the plugin, e.g. import Input from './input.svelte'"
				},
				{ path: 'plugin.ts', message: 'fields.Bad: use lowercase names' }
			]
		});
	});

	it('takes pages from plugin.ts, in its order, with titles from their paths', async () => {
		const root = await project('my-plugin', 'empty');

		await write(root, {
			'views/report.svelte': '<h1>Report</h1>\n',
			'views/settings.svelte': '<h1>Settings</h1>\n',
			'plugin.ts': pluginFile(
				"import Report from './views/report.svelte';\nimport Settings from './views/settings.svelte';\n",
				"{ pages: { settings: { title: 'Plugin settings', navigation: false, component: Settings }, 'reports/monthly-report': { layout: 'full', component: Report } } }"
			)
		});

		const { bundle } = await buildBundle(root);

		expect(bundle.manifest.contributes.pages).toEqual([
			{
				path: 'settings',
				title: 'Plugin settings',
				component: 'ui/views/settings.svelte',
				navigation: false
			},
			{
				path: 'reports/monthly-report',
				title: 'Monthly report',
				component: 'ui/views/report.svelte',
				navigation: true,
				layout: 'full'
			}
		]);
	});

	it('refuses pages without a component of the plugin, and paths that are not lowercase', async () => {
		const root = await project('my-plugin', 'empty');

		await write(root, {
			'stats.svelte': '<p></p>\n',
			'icon-of-page.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>\n',
			'plugin.ts': pluginFile(
				"import Stats from './stats.svelte';\nimport icon from './icon-of-page.svg';\n",
				'{ pages: { Stats: { component: Stats }, a: { component: () => null }, b: { component: icon }, c: { component: Stats, icon: Stats } } } as never'
			)
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			issues: [
				{ path: 'plugin.ts', message: 'pages.Stats: use lowercase names' },
				{
					path: 'plugin.ts',
					message:
						"pages.a.component must be a Svelte component of the plugin, imported like a module: import Stats from './stats.svelte'"
				},
				{
					path: 'plugin.ts',
					message:
						"pages.b.component must be a Svelte component of the plugin, imported like a module: import Stats from './stats.svelte'"
				},
				{ path: 'plugin.ts', message: 'pages.c.icon: stats.svelte is not an .svg file' }
			]
		});
	});

	it('checks route paths', () => {
		expect(routePathProblem('/')).toBeNull();
		expect(routePathProblem('/items/:id')).toBeNull();
		expect(routePathProblem('/v2/status.json')).toBeNull();
		expect(routePathProblem('items')).toBe('starts with a slash, e.g. /items');
		expect(routePathProblem('/items/')).toBe(
			'has an empty segment; remove the extra or trailing slash'
		);
		expect(routePathProblem('/items/[id]')).toBe('"[id]" is written :id for a parameter');
		expect(routePathProblem('/Items')).toBe('use lowercase names');
		expect(routePathProblem('/assets/x')).toContain('served by Pouchbase itself');
		expect(routePathFor('items/[id]')).toBe('/items/:id');
		expect(routeFileFor('/items/:id')).toBe('routes/items/[id].ts');
		expect(routeFileFor('items/[id]')).toBe('routes/items/[id].ts');
		expect(routeFileFor('/')).toBe('routes/index.ts');
		expect(routeFileFor('Bad Path')).toBeNull();
	});

	it('refuses routes without handlers and routes that answer the same paths', async () => {
		const root = await project('my-plugin', 'empty');

		await write(root, {
			'plugin.ts': pluginFile(
				'',
				`{ routes: {
					'/stats': { get: () => new Response() },
					'/items/:id': { GET: () => new Response() },
					'/items/:slug': { GET: () => new Response() },
					'/items/[id]/x': { GET: () => new Response() }
				} } as never`
			)
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			issues: [
				{
					path: 'plugin.ts',
					message: 'routes["/stats"] has no GET, POST, PUT, PATCH, DELETE handler'
				},
				{
					path: 'plugin.ts',
					message:
						'routes["/items/:slug"] answers the same paths as routes["/items/:id"]; keep one of them'
				},
				{
					path: 'plugin.ts',
					message: 'routes["/items/[id]/x"]: "[id]" is written :id for a parameter'
				}
			]
		});
	});

	it('refuses contributes and server in the manifest', async () => {
		const root = await manifestOnlyProject();

		await expect(buildBundle(root)).rejects.toMatchObject({
			issues: expect.arrayContaining([
				{ path: 'pouchbase-plugin.json', message: '"contributes" is generated from plugin.ts' },
				{ path: 'pouchbase-plugin.json', message: '"server" is generated from plugin.ts' }
			])
		});
	});
});
