import type { PluginBundle } from '../src/bundle.js';

import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseBundle } from '../src/bundle.js';
import { addContribution } from '../src/cli/add.js';
import { withDevVersion } from '../src/cli/dev-server.js';
import { discoverProject, readPageMeta, routeFileFor, routePathOf } from '../src/cli/discover.js';
import { askTemplate, initProject, parseTemplate } from '../src/cli/init.js';
import { printManifest } from '../src/cli/manifest-command.js';
import { createLogger } from '../src/cli/output.js';
import { buildBundle, checkServer, loadManifest } from '../src/cli/project.js';
import { generateServerEntry } from '../src/cli/server-entry.js';
import { TEMPLATES } from '../src/cli/templates.js';
import { parseManifest, previewOf } from '../src/manifest.js';
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

/** A plugin in the legacy layout: `contributes` and `server` in the manifest, `ui/`, `server/`. */
async function legacyProject(id = 'legacy-plugin') {
	const root = await project(id, 'empty');

	await write(root, {
		'pouchbase-plugin.json': JSON.stringify({
			apiVersion: 1,
			id,
			name: 'Legacy',
			server: 'server/index.ts',
			contributes: {
				fields: [
					{
						type: 'color',
						label: 'Color',
						description: 'A color.',
						column: 'TEXT',
						input: 'ui/color-input.svelte'
					}
				]
			}
		}),
		'ui/color-input.svelte': '<input />\n',
		'server/index.ts': `export default { fields: { color: {} }, routes: { 'GET /ping': () => new Response('pong') } };\n`
	});

	return root;
}

describe('init', () => {
	it.each(TEMPLATES)('creates a valid plugin from the %s template', async (template) => {
		const root = await project('auth-acme', template);
		const manifest = await readJson(join(root, 'pouchbase-plugin.json'));
		const tsconfig = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'));
		const { bundle, warnings, project: found } = await buildBundle(root);

		expect(manifest.$schema).toBe('https://pouchbase.io/schemas/plugin-manifest.json');
		expect(manifest.version).toBeUndefined();
		expect(manifest.contributes).toBeUndefined();
		expect(manifest.server).toBeUndefined();
		expect(manifest.name).toBe(template === 'auth-provider' ? 'Acme sign-in' : 'Auth acme');
		expect(tsconfig.include).toEqual([
			'fields',
			'pages',
			'auth',
			'routes',
			'lib',
			'plugin.ts',
			'test'
		]);
		expect(manifest.engines).toEqual({ pouchbase: '>=0.10.0' });
		expect(found.mode).toBe('convention');
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
		expect(bundle.files['server.js']).toContain('GET /hello');
		expect(bundle.files['ui/pages/hello.svelte']).toContain("from '@pouchbasejs/ui/button'");
	});

	it('writes the empty template without server code', async () => {
		const root = await project('nothing-yet', 'empty');
		const { bundle } = await buildBundle(root);

		expect(bundle.manifest.server).toBeUndefined();
		expect(bundle.manifest.contributes).toEqual({ fields: [], pages: [], authProviders: [] });
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
	it('adds a field type as files, without touching the manifest', async () => {
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
			manifestChanged: false,
			layout: 'convention'
		});
		expect(await readFile(join(root, 'pouchbase-plugin.json'), 'utf8')).toBe(before);
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
		const { bundle } = await buildBundle(root);

		expect(result.created).toEqual(['pages/reports/monthly.svelte']);
		expect(result.manifestChanged).toBe(true);
		expect(text).toContain('\t"categories"');
		expect(text.endsWith('}\n')).toBe(true);
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

	it('adds routes, with [id] params', async () => {
		const root = await project('my-plugin', 'empty');

		expect((await addContribution(root, 'route', 'items/:id')).created).toEqual([
			'routes/items/[id].ts'
		]);
		expect((await addContribution(root, 'route', '/')).created).toEqual(['routes/index.ts']);
		expect((await addContribution(root, 'route', 'stats')).created).toEqual(['routes/stats.ts']);

		const { routes, bundle } = await buildBundle(root);

		expect(routes).toEqual(['GET /', 'GET /items/:id', 'GET /stats']);
		expect(bundle.manifest.server).toBe('server.js');
		expect(contributionSummary(bundle.manifest, routes).routes).toEqual([
			'GET /',
			'GET /items/:id',
			'GET /stats'
		]);

		const definition = (await import(
			`data:text/javascript;base64,${Buffer.from(bundle.files['server.js']!).toString('base64')}`
		)) as { default: { routes: Record<string, (request: Request, ctx: unknown) => Response> } };
		const response = definition.default.routes['GET /items/:id']!(new Request('https://x.test'), {
			params: { id: '42' },
			admin: false
		});

		expect(await response.json()).toEqual({
			path: '/items/:id',
			params: { id: '42' },
			admin: false
		});
	});

	it('refuses invalid ids and existing files', async () => {
		const root = await project('my-plugin', 'field');

		await expect(addContribution(root, 'field', 'Bad Type')).rejects.toThrow(
			"can't be a field type"
		);
		await expect(addContribution(root, 'field', 'color')).rejects.toThrow(
			'fields/color already exists'
		);
		await expect(addContribution(root, 'route', 'assets/logo')).rejects.toThrow(
			"can't be a route path"
		);
		await write(root, { 'pages/stats/index.svelte': '<p>Stats</p>\n' });
		await expect(addContribution(root, 'page', 'stats')).rejects.toThrow(
			'pages/stats/index.svelte already exists'
		);
	});

	it('keeps the legacy layout in a legacy plugin, without routes', async () => {
		const root = await legacyProject();
		const result = await addContribution(root, 'page', 'stats');
		const manifest = await loadManifest(root);

		expect(result).toMatchObject({
			created: ['ui/stats-page.svelte'],
			manifestChanged: true,
			layout: 'legacy'
		});
		expect(manifest.contributes.pages.map((page) => page.path)).toEqual(['stats']);
		await expect(addContribution(root, 'route', 'stats')).rejects.toThrow(
			'add route needs the convention layout'
		);
	});
});

describe('discoverProject', () => {
	it('builds the demo plugin with the contributions of its manifest before the convention', async () => {
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
			pages: [
				{
					path: 'overview',
					title: 'Demo',
					component: 'ui/pages/overview.svelte',
					navigation: true,
					icon: 'ui/icons/lucide/layout-dashboard.svg'
				},
				// By their `order`, not by file name.
				{ path: 'fields', title: 'Field playground', icon: 'ui/icons/lucide/shapes.svg' },
				{ path: 'api', title: 'API explorer', icon: 'ui/icons/lucide/terminal.svg' }
			],
			authProviders: []
		});
		expect(routes.sort()).toEqual([
			'GET /github-status',
			'GET /info',
			'GET /items/:id',
			'GET /me',
			'POST /echo'
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
		expect(stdout).toContain('› Reading the settings in plugin.ts');
		expect(stdout).toContain('  1 setting: greeting (text)');
		expect(stdout[0]).toBe('› Reading pouchbase-plugin.json');
	});

	it('needs an input for every field type', async () => {
		const root = await project('my-plugin', 'field');

		await rm(join(root, 'fields/color/input.svelte'));
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: 'fields/color: has no input.svelte: every field type needs an input component',
			hint: 'pouchbase-plugin add field <type> shows what the files of a field type look like.'
		});
	});

	it('needs a description and a column for every field type', async () => {
		const root = await project('my-plugin', 'empty');

		await write(root, {
			'fields/rating/field.ts': 'export default { label: "Rating" };\n',
			'fields/rating/input.svelte': '<input />\n'
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			issues: [
				{
					path: 'fields/rating/field.ts',
					message:
						'defineField needs a description: one sentence shown when an admin picks the type'
				},
				{
					path: 'fields/rating/field.ts',
					message:
						'defineField needs a column: TEXT, INTEGER, REAL or BLOB, the storage class of the value'
				}
			]
		});
	});

	it('takes page titles from <script module>, else from the file name', async () => {
		const root = await project('my-plugin', 'empty');

		await write(root, {
			'pages/monthly-report.svelte': '<h1>Report</h1>\n',
			'pages/settings/index.svelte': `<script module lang="ts">
	import type { PageMeta } from '@pouchbasejs/plugin-sdk/ui';

	export const page = { title: 'Plugin settings', navigation: false } satisfies PageMeta;
</script>

<h1>Settings</h1>
`,
			'pages/_parts/header.svelte': '<header></header>\n'
		});

		const { bundle } = await buildBundle(root);

		expect(bundle.manifest.contributes.pages).toEqual([
			{
				path: 'monthly-report',
				title: 'Monthly report',
				component: 'ui/pages/monthly-report.svelte',
				navigation: true
			},
			{
				path: 'settings',
				title: 'Plugin settings',
				component: 'ui/pages/settings/index.svelte',
				navigation: false
			}
		]);
		expect(bundle.files['ui/pages/_parts/header.svelte']).toBeUndefined();
	});

	it('refuses page metadata that is not a literal, and names that are not lowercase', async () => {
		expect(
			readPageMeta('pages/a.svelte', '<script module>export const page = { title: t };</script>')
		).toEqual({
			problem:
				"export const page must be a literal object, e.g. { title: 'Stats' }; it can't use imports, variables or function calls"
		});

		const root = await project('my-plugin', 'empty');

		await write(root, { 'pages/Stats.svelte': '<p></p>\n', 'pages/index.svelte': '<p></p>\n' });
		await expect(discoverProject(root)).rejects.toMatchObject({
			issues: [
				{
					path: 'pages/Stats.svelte',
					message: 'use lowercase names'
				},
				{
					path: 'pages/index.svelte',
					message:
						'a page needs a path below /plugins/<id>/; give the file a name, e.g. pages/overview.svelte'
				}
			]
		});
	});

	it('maps route files to paths', () => {
		expect(routePathOf('routes/index.ts')).toEqual({ path: '/' });
		expect(routePathOf('routes/items/index.ts')).toEqual({ path: '/items' });
		expect(routePathOf('routes/items/[id].ts')).toEqual({ path: '/items/:id' });
		expect(routePathOf('routes/v2/status.json.ts')).toEqual({ path: '/v2/status.json' });
		expect(routePathOf('routes/Items.ts')).toEqual({ problem: 'use lowercase names' });
		expect(routePathOf('routes/assets/x.ts')).toMatchObject({
			problem: expect.stringContaining('served by Pouchbase itself')
		});
		expect(routeFileFor('/items/:id')).toBe('routes/items/[id].ts');
		expect(routeFileFor('items/[id]')).toBe('routes/items/[id].ts');
		expect(routeFileFor('/')).toBe('routes/index.ts');
		expect(routeFileFor('Bad Path')).toBeNull();
	});

	it('refuses route files without handlers and routes that answer the same path', async () => {
		const root = await project('my-plugin', 'empty');

		await write(root, {
			'routes/stats.ts': 'export const get = () => new Response();\n',
			'routes/items/[id].ts': 'export const GET = () => new Response();\n',
			'routes/items/[slug].ts': 'export const GET = () => new Response();\n'
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			message:
				'routes/items/[slug].ts: answers /items/:slug, like routes/items/[id].ts; keep one of them'
		});
		await rm(join(root, 'routes/items/[slug].ts'));
		await expect(discoverProject(root)).rejects.toMatchObject({
			message: 'routes/stats.ts: exports no GET, POST, PUT, PATCH, DELETE function'
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
	import lodash from 'lodash';
</script>
`
		});
		await expect(discoverProject(root)).rejects.toMatchObject({
			issues: [
				{
					path: 'fields/color/preview.svelte',
					message:
						'imports fields/color/field.ts, which is server code; move what both need into a shared file, e.g. lib/'
				},
				{
					path: 'fields/color/preview.svelte',
					message: expect.stringContaining('imports lodash')
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

	it('refuses to mix the legacy and the convention layout', async () => {
		const root = await legacyProject();

		await write(root, { 'routes/ping.ts': 'export const GET = () => new Response();\n' });
		await expect(discoverProject(root)).rejects.toMatchObject({
			message:
				'pouchbase-plugin.json has "contributes" and "server", but the plugin also has routes/',
			hint: expect.stringContaining('Use one layout')
		});
	});

	it('still builds the legacy layout, with a deprecation warning', async () => {
		const root = await legacyProject();
		const { bundle, warnings, routes, project: found } = await buildBundle(root);

		expect(found.mode).toBe('legacy');
		expect(found.serverEntry).toContain('server/index.ts');
		expect(warnings).toEqual([
			{
				path: 'pouchbase-plugin.json',
				message: expect.stringContaining('"contributes" and "server" are deprecated')
			}
		]);
		expect(routes).toEqual(['GET /ping']);
		expect(bundle.manifest.server).toBe('server.js');
		expect(bundle.manifest.contributes.fields[0]?.input).toBe('ui/color-input.svelte');
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
		expect(stdout.at(-1)).toBe('✓ Generated the manifest of hello-page@0.1.0 (convention layout)');
		expect(stderr).toEqual([]);
	});
});

describe('generateServerEntry', () => {
	it('imports every file and keys the routes', () => {
		const source = generateServerEntry(
			{
				fields: [{ type: 'rating', file: 'fields/rating/field.ts' }],
				authProviders: [{ id: 'acme', file: 'auth/acme/provider.ts' }],
				routes: [
					{ path: '/info', file: 'routes/info.ts', methods: ['GET'] },
					{ path: '/items/:id', file: 'routes/items/[id].ts' }
				]
			},
			{ root: dir }
		);
		const base = dir.split(sep).join('/');

		expect(source).toContain(`import field0 from "${base}/fields/rating/field.ts";`);
		expect(source).toContain(`import * as route1 from "${base}/routes/items/[id].ts";`);
		expect(source).toContain('"GET /info": route0.GET');
		expect(source).toContain('...routes([');
		expect(generateServerEntry({ fields: [], authProviders: [], routes: [] })).not.toContain(
			'function routes'
		);
	});
});

describe('checkServer', () => {
	const manifest = (contributes: Record<string, unknown>) => {
		const result = parseManifest({
			apiVersion: 1,
			id: 'my-plugin',
			name: 'My plugin',
			version: '1.0.0',
			description: 'A plugin.',
			license: 'MIT',
			server: 'server/index.ts',
			contributes
		});

		if (!result.success) {
			throw new Error(JSON.stringify(result.issues));
		}

		return result.manifest;
	};

	it('finds missing, incomplete and unknown handlers', async () => {
		const { issues } = await checkServer(
			manifest({
				authProviders: [
					{ id: 'acme', label: 'Acme' },
					{ id: 'other', label: 'Other' }
				]
			}),
			`export default {
				authProviders: { acme: { authorizeUrl: 'x', tokenUrl: 'y', scopes: [] } },
				fields: { color: {} },
				routes: { 'stats': () => new Response(), 'GET /ok': () => new Response() }
			};`
		);

		expect(issues).toEqual([
			{
				path: 'contributes.authProviders.0',
				message: 'The handler in server/index.ts lacks pkce, profile'
			},
			{
				path: 'contributes.authProviders.1',
				message: 'No handler: add authProviders.other to server/index.ts'
			},
			{
				path: 'server/index.ts',
				message: 'fields.color has no contribution in contributes.fields of pouchbase-plugin.json'
			},
			{
				path: 'server/index.ts',
				message: 'routes["stats"]: use a method and a path, e.g. "GET /stats"'
			}
		]);
	});

	it('asks for a default export and warns when the code does not load', async () => {
		await expect(checkServer(manifest({}), 'export const x = 1;')).resolves.toEqual({
			issues: [{ path: 'server/index.ts', message: 'Must default-export definePlugin({ ... })' }],
			warnings: []
		});

		const { issues, warnings } = await checkServer(manifest({}), 'throw new Error("boom");');

		expect(issues).toEqual([]);
		expect(warnings[0]?.message).toContain('boom');
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

describe('field previews', () => {
	it('still reads cell.svelte, the former name of preview.svelte, with a warning', async () => {
		const root = await project('old-names', 'field');

		await rename(join(root, 'fields/color/preview.svelte'), join(root, 'fields/color/cell.svelte'));

		const { bundle, warnings } = await buildBundle(root);

		expect(bundle.manifest.contributes.fields[0]?.preview).toBe('ui/fields/color/cell.svelte');
		expect(bundle.files['ui/fields/color/cell.svelte']).toBeDefined();
		expect(warnings).toContainEqual({
			path: 'fields/color/cell.svelte',
			message: expect.stringContaining('rename it to preview.svelte')
		});
	});

	it('reads cell in a manifest as the preview', () => {
		const result = parseManifest({
			id: 'old',
			name: 'Old',
			description: 'A plugin from before the preview.',
			license: 'MIT',
			version: '1.0.0',
			apiVersion: 1,
			contributes: {
				fields: [
					{
						type: 'color',
						label: 'Color',
						description: 'A color.',
						column: 'TEXT',
						input: 'ui/input.svelte',
						cell: 'ui/cell.svelte'
					}
				]
			}
		});

		expect(result.success).toBe(true);
		expect(result.success && previewOf(result.manifest.contributes.fields[0]!)).toBe(
			'ui/cell.svelte'
		);
	});
});
