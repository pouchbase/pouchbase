import type { PluginBundle } from '../src/bundle.js';
import type { ServerDefinition } from '../src/server.js';

import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseBundle } from '../src/bundle.js';
import { addContribution, addToDefinition } from '../src/cli/add.js';
import { withDevVersion } from '../src/cli/dev-server.js';
import {
	discoverProject,
	routeFileFor,
	routePathFor,
	routePathProblem
} from '../src/cli/discover.js';
import { askTemplate, initProject, parseTemplate } from '../src/cli/init.js';
import { printManifest } from '../src/cli/manifest-command.js';
import { createLogger } from '../src/cli/output.js';
import { buildBundle } from '../src/cli/project.js';
import { generateServerEntry } from '../src/cli/server-entry.js';
import { TEMPLATES } from '../src/cli/templates.js';
import { parseManifest } from '../src/manifest.js';
import { contributionSummary } from '../src/registry.js';

const SDK_ROOT = resolve(import.meta.dirname, '..');
const DEMO_ROOT = resolve(import.meta.dirname, '../../../examples/plugin-demo');
const SVELTE_ROOT = realpathSync(resolve(import.meta.dirname, '../../../node_modules/svelte'));

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'pouchbase-plugin-'));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

/**
 * A new plugin in `dir`, with this SDK linked in as its dependency so the server code bundles, and
 * the repository's Svelte so the components compile.
 */
async function project(id: string, template: (typeof TEMPLATES)[number]) {
	const { root } = await initProject(join(dir, id), { template });

	await mkdir(join(root, 'node_modules', '@pouchbasejs'), { recursive: true });
	await symlink(SDK_ROOT, join(root, 'node_modules', '@pouchbasejs', 'plugin-sdk'), 'junction');
	await symlink(SVELTE_ROOT, join(root, 'node_modules', 'svelte'), 'junction');

	return root;
}

/** Writes files into a plugin, creating their folders. */
async function write(root: string, files: Record<string, string>) {
	for (const [path, contents] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), contents);
	}
}

/** `pouchbase-plugin.json` as written, without defaults. */
type ManifestJson = Record<string, unknown> & { contributes: Record<string, unknown[]> };

async function readJson(path: string) {
	return JSON.parse(await readFile(path, 'utf8')) as ManifestJson;
}

/** A logger that writes into arrays of lines, without colors. */
function capture() {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const stream = (lines: string[]) => ({ write: (text: string) => lines.push(text.trimEnd()) });
	const log = createLogger({ color: false, stdout: stream(stdout), stderr: stream(stderr) });

	return { log, stdout, stderr };
}

/** A plugin whose manifest lists its contributions and server code, which the CLI generates. */
async function manifestOnlyProject(id = 'manifest-only') {
	const root = await project(id, 'empty');

	await write(root, {
		'pouchbase-plugin.json': JSON.stringify({
			apiVersion: 1,
			id,
			name: 'Manifest only',
			server: 'server/index.ts',
			contributes: { fields: [] }
		})
	});

	return root;
}

/** `plugin.ts` with `body` as its imports and the argument of `definePlugin`. */
function pluginFile(imports: string, definition: string) {
	return `import { definePlugin } from '@pouchbasejs/plugin-sdk/server';
${imports}
export default definePlugin(${definition});
`;
}

/** The server code of a bundle, run in Node.js: what the host runs. */
async function serverDefinition(bundle: PluginBundle) {
	const url = `data:text/javascript;base64,${Buffer.from(bundle.files['server.js']!).toString('base64')}`;

	return ((await import(url)) as { default: ServerDefinition }).default;
}

describe('init', () => {
	it.each(TEMPLATES)('creates a valid plugin from the %s template', async (template) => {
		const root = await project('auth-acme', template);
		const manifest = await readJson(join(root, 'pouchbase-plugin.json'));
		const tsconfig = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'));
		const { bundle, warnings } = await buildBundle(root);

		expect(manifest.$schema).toBe('https://pouchbase.io/schemas/plugin-manifest.json');
		expect(manifest.version).toBeUndefined();
		expect(manifest.contributes).toBeUndefined();
		expect(manifest.server).toBeUndefined();
		expect(manifest.name).toBe(template === 'auth-provider' ? 'Acme sign-in' : 'Auth acme');
		expect(tsconfig.include).toEqual(['**/*.ts', '**/*.svelte']);
		expect(tsconfig.compilerOptions.types).toEqual(['svelte', '@pouchbasejs/plugin-sdk/env']);
		expect(await readFile(join(root, 'vitest.config.ts'), 'utf8')).toContain('pouchbasePlugin()');
		expect(await readFile(join(root, 'plugin.ts'), 'utf8')).toContain('interface Register');
		expect(manifest.engines).toEqual({ pouchbase: '>=0.10.0' });
		expect(bundle.manifest.apiVersion).toBe(1);
		expect(bundle.manifest.version).toBe('0.1.0');
		expect(bundle.manifest.license).toBe('MIT');
		expect(bundle.manifest.icon).toBe('ui/icon.svg');
		expect(bundle.files['ui/icon.svg']).toContain('<svg');
		expect(warnings).toEqual([]);
	});

	it('writes the field template', async () => {
		const root = await project('color-picker', 'field');
		const { bundle, routes } = await buildBundle(root);

		expect(bundle.manifest.description).toBe('Adds a color field type.');
		expect(bundle.manifest.server).toBe('server.js');
		expect(bundle.manifest.contributes.fields).toEqual([
			{
				type: 'color',
				label: 'Color',
				description: 'A color as a hex code, e.g. #ff6600.',
				column: 'TEXT',
				input: 'ui/fields/color/input.svelte',
				preview: 'ui/fields/color/preview.svelte',
				icon: 'ui/icons/lucide/palette.svg'
			}
		]);
		expect(routes).toEqual([]);
		expect(Object.keys(bundle.files).sort()).toEqual([
			'server.js',
			'ui/fields/color/input.svelte',
			'ui/fields/color/preview.svelte',
			'ui/icon.svg',
			'ui/icons/lucide/palette.svg',
			'ui/tailwind.css'
		]);
		expect(bundle.files['ui/icons/lucide/palette.svg']).toMatch(/^<svg [^>]*viewBox="0 0 24 24">/);
		// The preview's Tailwind classes, compiled with the dashboard's tokens.
		expect(bundle.files['ui/tailwind.css']).toContain('.inline-flex');

		// The server code has the handlers, without the components and the icon.
		const { fields } = await serverDefinition(bundle);

		expect(Object.keys(fields!.color!).sort()).toEqual([
			'column',
			'description',
			'label',
			'serialize',
			'validate'
		]);
	});

	it('writes the auth-provider template', async () => {
		const root = await project('auth-acme', 'auth-provider');
		const { bundle } = await buildBundle(root);

		expect(bundle.manifest.categories).toEqual(['auth']);
		expect(bundle.manifest.permissions.network).toEqual(['id.example.com']);
		expect(bundle.manifest.contributes.authProviders).toEqual([
			{
				id: 'acme',
				label: 'Acme',
				consoleUrl: 'https://id.example.com/apps',
				icon: 'ui/auth/acme/icon.svg'
			}
		]);
		expect(bundle.files['ui/auth/acme/icon.svg']).toContain('<svg');
		expect((await serverDefinition(bundle)).authProviders?.acme).not.toHaveProperty('icon');
	});

	it('writes the page template with a route', async () => {
		const root = await project('hello-page', 'page');
		const { bundle, routes } = await buildBundle(root);

		expect(bundle.manifest.categories).toEqual(['pages']);
		expect(bundle.manifest.contributes.pages).toEqual([
			{
				path: 'hello',
				title: 'Hello',
				component: 'ui/pages/hello.svelte',
				navigation: true,
				icon: 'ui/icons/lucide/hand.svg'
			}
		]);
		expect(routes).toEqual(['GET /hello']);
		expect(Object.keys((await serverDefinition(bundle)).routes!)).toEqual(['GET /hello']);
		expect(bundle.files['ui/pages/hello.svelte']).toContain("from '@pouchbasejs/ui/button'");
	});

	it('writes the empty template without server code', async () => {
		const root = await project('nothing-yet', 'empty');
		const { bundle } = await buildBundle(root);

		expect(bundle.manifest.server).toBeUndefined();
		expect(bundle.manifest.contributes).toEqual({
			fields: [],
			pages: [],
			authProviders: [],
			collections: []
		});
		expect(Object.keys(bundle.files)).toEqual(['ui/icon.svg']);
	});

	it('refuses a directory that is not empty or not a plugin id', async () => {
		await writeFile(join(dir, 'file.txt'), '');
		await expect(initProject(join(dir, 'Not_An_Id'))).rejects.toThrow("can't be a plugin id");
		await mkdir(join(dir, 'taken'));
		await writeFile(join(dir, 'taken', 'file.txt'), '');
		await expect(initProject(join(dir, 'taken'))).rejects.toThrow('is not empty');
	});

	it('parses --template and does not prompt without a terminal', async () => {
		expect(parseTemplate('page')).toBe('page');
		expect(() => parseTemplate('nope')).toThrow('Unknown template: nope');
		await expect(askTemplate(new PassThrough(), new PassThrough())).resolves.toBe('field');
	});
});

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
						"definePlugin({ extra }) isn't something a plugin adds; use settings, fields, pages, authProviders, collections, routes"
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

	it('refuses imports of missing files and files outside the plugin', async () => {
		const root = await project('my-plugin', 'empty');

		await write(root, {
			'plugin.ts': pluginFile(
				"import Stats from './stats.svelte';\n",
				'{ pages: { stats: { component: Stats } } }'
			)
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: expect.stringContaining("stats.svelte doesn't exist")
		});

		await write(root, {
			'plugin.ts': pluginFile(
				"import Other from '../other.svelte';\n",
				'{ pages: { stats: { component: Other } } }'
			)
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: expect.stringContaining('which is outside the plugin')
		});
	});

	it('includes the files UI files import, and refuses server code and packages', async () => {
		const root = await project('my-plugin', 'field');

		await write(root, {
			'lib/format.ts': 'export const upper = (value: string): string => value.toUpperCase();\n',
			'fields/color/preview.svelte': `<script lang="ts">
	import { upper } from '../../lib/format.js';
</script>

{upper('x')}
`
		});

		const { bundle } = await buildBundle(root);

		expect(bundle.files['ui/lib/format.js']).toContain('toUpperCase');

		await write(root, {
			'fields/color/preview.svelte': `<script lang="ts">
	import field from './field.js';
	import plugin from '../../plugin.js';
	import lodash from 'lodash';
</script>
`
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			issues: [
				{
					path: 'fields/color/preview.svelte',
					message:
						'imports plugin.ts, which is server code; move what both need into a shared file, e.g. lib/'
				},
				{
					path: 'fields/color/preview.svelte',
					message: expect.stringContaining('imports lodash')
				},
				{
					path: 'fields/color/preview.svelte',
					message:
						'imports fields/color/field.ts, which is server code (it imports @pouchbasejs/plugin-sdk/server); move what both need into a shared file, e.g. lib/'
				}
			]
		});
	});

	it('allows only the exact modules the host provides, and static imports', async () => {
		const root = await project('my-plugin', 'field');

		await write(root, {
			'fields/color/preview.svelte': `<script lang="ts">
	import { compile } from 'svelte/compiler';
	import * as Nope from '@pouchbasejs/ui/no-such-component';
	import { writable } from 'svelte/store';

	const later = import('./later.js');
</script>
`
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			issues: [
				{
					path: 'fields/color/preview.svelte',
					message: expect.stringMatching(
						/^imports svelte\/compiler, which Pouchbase doesn't provide/
					)
				},
				{
					path: 'fields/color/preview.svelte',
					message: expect.stringMatching(
						/^imports @pouchbasejs\/ui\/no-such-component, which Pouchbase doesn't provide/
					)
				},
				{
					path: 'fields/color/preview.svelte',
					message: 'imports ./later.js with import(); UI files may only use static imports'
				}
			],
			hint: expect.stringContaining('@pouchbasejs/ui/button')
		});
	});

	it('compiles the components like the host, with errors at file:line:column', async () => {
		const root = await project('my-plugin', 'field');
		const { log, stdout } = capture();

		await buildBundle(root, { log });
		expect(stdout).toContain('› Compiling the components');
		expect(stdout).toContain('  2 components compiled');

		await write(root, {
			'fields/color/preview.svelte': `<script lang="ts">
	let { value } = $props();
</script>

{#if value}
	<span>{value}</span>
`
		});
		await expect(buildBundle(root)).rejects.toMatchObject({
			message: 'Problems in the UI files',
			issues: [
				{
					path: 'fields/color/preview.svelte:5:1',
					message: 'Block was left open'
				}
			]
		});

		// A dynamic import() the regex can't see, in compiled TypeScript: the host's rule.
		await write(root, {
			'lib/load.ts': 'const name = "./x.js";\nexport const load = () => import(name);\n',
			'fields/color/preview.svelte': `<script lang="ts">
	import { load } from '../../lib/load.js';

	load();
</script>
`
		});
		await expect(buildBundle(root)).rejects.toMatchObject({
			issues: [
				{
					path: 'lib/load.ts',
					message: 'Dynamic import() is not allowed; import the module statically'
				}
			],
			hint: expect.stringContaining('statically')
		});
	});

	it('warns when the project has no Svelte to compile the components with', async () => {
		const { root } = await initProject(join(dir, 'my-plugin'), { template: 'field' });

		await mkdir(join(root, 'node_modules', '@pouchbasejs'), { recursive: true });
		await symlink(SDK_ROOT, join(root, 'node_modules', '@pouchbasejs', 'plugin-sdk'), 'junction');

		const { warnings } = await buildBundle(root);

		expect(warnings).toContainEqual({
			path: 'package.json',
			message:
				"Can't compile the components: add svelte as a devDependency; until then, Svelte errors only show when the plugin is installed"
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

describe('manifest command', () => {
	it('prints only the manifest as JSON, with the feedback elsewhere', async () => {
		const root = await project('hello-page', 'page');
		const { log, stdout, stderr } = capture();
		const output: string[] = [];

		await printManifest(root, { log, write: (text) => output.push(text) });

		const manifest = JSON.parse(output.join(''));

		expect(output.join('')).toMatch(/^\{\n\t"\$schema"/);
		expect(manifest).toMatchObject({
			id: 'hello-page',
			server: 'server.js',
			contributes: { pages: [{ path: 'hello', title: 'Hello' }] }
		});
		expect(stdout.at(-1)).toBe('✓ Generated the manifest of hello-page@0.1.0');
		expect(stderr).toEqual([]);
	});
});

describe('generateServerEntry', () => {
	it('imports plugin.ts by its path in the plugin', () => {
		const base = dir.split(sep).join('/');

		expect(generateServerEntry({ plugin: 'plugin.ts' }, { root: dir })).toContain(
			`import plugin from "${base}/plugin.ts";`
		);
		expect(generateServerEntry({ plugin: 'plugin.js' })).toContain(
			'import plugin from "./plugin.js";'
		);
	});
});

describe('withDevVersion', () => {
	it('serves every build as a new prerelease', () => {
		const bundle = {
			format: 'pouchbase-plugin-bundle',
			bundleVersion: 1,
			manifest: manifestFor('1.2.0'),
			files: {}
		} satisfies PluginBundle;
		const first = withDevVersion(bundle, 1);
		const second = withDevVersion(bundle, 2);
		const parsed = parseBundle(second.bytes);

		expect(first.bundle.manifest.version).toBe('1.2.0-dev.1');
		expect(parsed.success && parsed.bundle.manifest.version).toBe('1.2.0-dev.2');
		expect(bundle.manifest.version).toBe('1.2.0');
		expect(
			withDevVersion({ ...bundle, manifest: manifestFor('1.0.0-beta.1') }, 3).bundle.manifest
				.version
		).toBe('1.0.0-beta.1-dev.3');
	});
});

function manifestFor(version: string) {
	const result = parseManifest({
		apiVersion: 1,
		id: 'my-plugin',
		name: 'My plugin',
		version,
		description: 'A plugin.',
		license: 'MIT'
	});

	if (!result.success) {
		throw new Error(JSON.stringify(result.issues));
	}

	return result.manifest;
}
