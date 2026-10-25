import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseBundle, serializeBundle } from '../src/bundle.js';
import { discoverProject } from '../src/cli/discover.js';
import { ICON_CACHE_DIR, iconSetSvg, isIconifyName } from '../src/cli/icons.js';
import { initProject } from '../src/cli/init.js';
import { createLogger } from '../src/cli/output.js';
import { buildBundle } from '../src/cli/project.js';
import { parseManifest } from '../src/manifest.js';
import { svgIconIssues } from '../src/svg.js';

const SDK_ROOT = resolve(import.meta.dirname, '..');

const SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'pouchbase-icons-'));
});

afterEach(async () => {
	vi.unstubAllGlobals();
	await rm(dir, { recursive: true, force: true });
});

/** An empty plugin with this SDK linked in, so its server code bundles. */
async function project(id = 'my-plugin') {
	const { root } = await initProject(join(dir, id), { template: 'empty' });

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

/** A field type `color` whose `defineField` has `icon` (left out when `undefined`). */
function colorField(icon?: string) {
	return {
		'fields/color/field.ts': `export default { label: 'Color', description: 'A color.', column: 'TEXT'${icon === undefined ? '' : `, icon: ${JSON.stringify(icon)}`} };\n`,
		'fields/color/input.svelte': '<input />\n'
	};
}

function capture() {
	const stdout: string[] = [];
	const stream = { write: (text: string) => stdout.push(text.trimEnd()) };
	const log = createLogger({ color: false, stdout: stream, stderr: stream });

	return { log, stdout };
}

describe('svgIconIssues', () => {
	it('accepts plain SVG, with a prolog and local references', () => {
		expect(svgIconIssues(SVG)).toEqual([]);
		expect(
			svgIconIssues(
				'<?xml version="1.0"?>\n<!-- An icon -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="a" d="M0 0h1"/></defs><use href="#a"/><rect fill="url(#a)"/></svg>\n'
			)
		).toEqual([]);
	});

	it('refuses what is not a plain SVG image', () => {
		expect(svgIconIssues('<html></html>')).toEqual([
			'is not an SVG image: it must start with <svg and end with </svg>'
		]);
		expect(svgIconIssues('<svg><script>alert(1)</script></svg>')).toEqual([
			'has a <script>; icons are images and run no code'
		]);
		expect(svgIconIssues('<svg onload="alert(1)"></svg>')).toEqual([
			'has an event handler attribute (on...="..."); icons run no code'
		]);
		expect(svgIconIssues('<svg><image href="https://example.com/a.png"/></svg>')).toEqual([
			'refers to https://example.com/a.png; icons may only refer to their own elements (#id)'
		]);
		expect(svgIconIssues('<svg><rect style="fill: url(https://x.test/a)"/></svg>')).toEqual([
			'refers to https://x.test/a; icons may only refer to their own elements (#id)'
		]);
		expect(svgIconIssues('<svg><foreignObject></foreignObject></svg>')).toEqual([
			'has a <foreignObject>; icons are plain SVG'
		]);
		expect(svgIconIssues(`<svg>${' '.repeat(40 * 1024)}</svg>`)).toEqual([
			'is 41 KiB; an icon may be at most 32 KiB'
		]);
	});
});

describe('iconSetSvg', () => {
	const set = {
		prefix: 'test',
		width: 24,
		height: 24,
		icons: { dot: { body: '<circle cx="12" cy="12" r="4"/>' } },
		aliases: { flipped: { parent: 'dot', hFlip: true }, wide: { parent: 'dot', width: 32 } }
	};

	it('turns an icon of an Iconify JSON set into SVG, with aliases', () => {
		expect(iconSetSvg(set, 'dot')).toBe(
			'<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/></svg>'
		);
		expect(iconSetSvg(set, 'wide')).toContain('viewBox="0 0 32 24"');
		expect(iconSetSvg(set, 'flipped')).toContain(
			'<g transform="translate(12 12) scale(-1 1) translate(-12 -12)">'
		);
		expect(iconSetSvg(set, 'missing')).toBeNull();
	});

	it('tells Iconify names from file paths', () => {
		expect(isIconifyName('lucide:palette')).toBe(true);
		expect(isIconifyName('./icon.svg')).toBe(false);
		expect(isIconifyName('icons/palette.svg')).toBe(false);
	});
});

describe('icons of field types and pages', () => {
	it('resolves an Iconify name from the icon sets of the SDK, and logs it', async () => {
		const root = await project();
		const fetch = vi.fn();

		vi.stubGlobal('fetch', fetch);
		await write(root, colorField('lucide:palette'));

		const { log, stdout } = capture();
		const { bundle } = await buildBundle(root, { log });

		expect(bundle.manifest.contributes.fields[0]?.icon).toBe('ui/icons/lucide/palette.svg');
		expect(bundle.files['ui/icons/lucide/palette.svg']).toMatch(/^<svg [^>]*viewBox="0 0 24 24">/);
		expect(stdout).toContain(
			'  Resolved icon lucide:palette for field color (@iconify-json/lucide of @pouchbasejs/plugin-sdk)'
		);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("prefers the plugin's own installed icon set", async () => {
		const root = await project();

		await write(root, {
			...colorField('lucide:palette'),
			'node_modules/@iconify-json/lucide/package.json': '{ "name": "@iconify-json/lucide" }\n',
			'node_modules/@iconify-json/lucide/icons.json': JSON.stringify({
				prefix: 'lucide',
				icons: { palette: { body: '<path d="M1 1h14"/>' } },
				width: 16,
				height: 16
			})
		});

		const { bundle } = await buildBundle(root);

		expect(bundle.files['ui/icons/lucide/palette.svg']).toBe(
			'<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16"><path d="M1 1h14"/></svg>'
		);
	});

	it('fetches an icon no installed set has once, and caches it', async () => {
		const root = await project();
		const fetch = vi.fn(async (url: string) => new Response(url && SVG, { status: 200 }));

		vi.stubGlobal('fetch', fetch);
		await write(root, colorField('mdi:palette'));

		const { log, stdout } = capture();
		const { bundle } = await buildBundle(root, { log });

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch.mock.calls[0]?.[0]).toBe('https://api.iconify.design/mdi/palette.svg');
		expect(stdout).toContain(
			'› Fetching icon mdi:palette for field color from https://api.iconify.design/mdi/palette.svg'
		);
		expect(bundle.files['ui/icons/mdi/palette.svg']).toBe(SVG);
		expect(await readFile(join(root, ICON_CACHE_DIR, 'mdi', 'palette.svg'), 'utf8')).toBe(SVG);

		const again = await buildBundle(root);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(again.bundle.files['ui/icons/mdi/palette.svg']).toBe(SVG);
	});

	it('explains an icon that does not exist or a name that is not one', async () => {
		const root = await project();

		vi.stubGlobal('fetch', async () => new Response('404', { status: 404 }));
		await write(root, colorField('mdi:no-such-icon'));
		await expect(discoverProject(root)).rejects.toMatchObject({
			message:
				"fields/color/field.ts: defineField icon: icon mdi:no-such-icon doesn't exist (https://api.iconify.design answered 404)",
			hint: 'Look the name up on https://icon-sets.iconify.design. Install the icon set (pnpm add -D @iconify-json/mdi) or add an .svg file and use its path.'
		});

		await write(root, colorField('Lucide:Palette'));
		await expect(discoverProject(root)).rejects.toMatchObject({
			message:
				'fields/color/field.ts: defineField icon: icon "Lucide:Palette" is not an Iconify name'
		});

		vi.stubGlobal('fetch', async () => {
			throw new Error('getaddrinfo ENOTFOUND');
		});
		await write(root, colorField('mdi:palette'));
		await expect(discoverProject(root)).rejects.toMatchObject({
			message:
				"fields/color/field.ts: defineField icon: can't fetch icon mdi:palette from https://api.iconify.design: getaddrinfo ENOTFOUND",
			hint: 'Install the icon set (pnpm add -D @iconify-json/mdi) or add an .svg file and use its path.'
		});
	});

	it('picks up icon.svg of a field type and the .svg of a page, or a path', async () => {
		const root = await project();

		await write(root, {
			...colorField(),
			'fields/color/icon.svg': SVG,
			'pages/stats.svelte': '<h1>Stats</h1>\n',
			'pages/stats.svg': SVG,
			'pages/reports/index.svelte': `<script module lang="ts">
	export const page = { title: 'Reports', icon: '../../lib/report.svg' };
</script>
`,
			'lib/report.svg': SVG
		});

		const { bundle } = await buildBundle(root);

		expect(bundle.manifest.contributes.fields[0]?.icon).toBe('ui/fields/color/icon.svg');
		expect(bundle.manifest.contributes.pages).toMatchObject([
			{ path: 'reports', icon: 'ui/lib/report.svg' },
			{ path: 'stats', icon: 'ui/pages/stats.svg' }
		]);
		expect(bundle.files['ui/fields/color/icon.svg']).toBe(SVG);
		expect(bundle.files['ui/pages/stats.svg']).toBe(SVG);
		expect(bundle.files['ui/lib/report.svg']).toBe(SVG);
	});

	it('refuses unsafe and missing icon files', async () => {
		const root = await project();

		await write(root, {
			...colorField(),
			'fields/color/icon.svg': '<svg onload="alert(1)"></svg>',
			'pages/stats.svelte': `<script module lang="ts">
	export const page = { icon: './missing.svg' };
</script>
`
		});

		await expect(discoverProject(root)).rejects.toMatchObject({
			issues: [
				{
					path: 'fields/color/icon.svg',
					message: 'has an event handler attribute (on...="..."); icons run no code'
				},
				{
					path: 'pages/stats.svelte',
					message: "page.icon: ./missing.svg doesn't exist in the plugin"
				}
			]
		});
	});
});

describe('the contract', () => {
	const manifest = {
		apiVersion: 1,
		id: 'my-plugin',
		name: 'My plugin',
		version: '1.0.0',
		description: 'A plugin.',
		license: 'MIT',
		contributes: {
			fields: [
				{
					type: 'color',
					label: 'Color',
					description: 'A color.',
					column: 'TEXT',
					input: 'ui/fields/color/input.svelte',
					icon: 'ui/icons/lucide/palette.svg'
				}
			],
			pages: [{ path: 'stats', title: 'Stats', component: 'ui/stats.svelte', icon: 'ui/stats.svg' }]
		}
	};

	it('accepts icons on field types and pages, as .svg files in ui/', () => {
		const result = parseManifest(manifest);

		expect(result.success && result.manifest.contributes.fields[0]?.icon).toBe(
			'ui/icons/lucide/palette.svg'
		);
		expect(result.success && result.manifest.contributes.pages[0]?.icon).toBe('ui/stats.svg');
		expect(
			parseManifest({
				...manifest,
				contributes: { pages: [{ ...manifest.contributes.pages[0], icon: 'stats.png' }] }
			})
		).toMatchObject({
			success: false,
			issues: [
				{ path: 'contributes.pages.0.icon', message: 'Must be a .svg file in the ui/ directory' }
			]
		});
	});

	it('needs the icons in a bundle, and plain SVG', () => {
		const files = {
			'ui/fields/color/input.svelte': '<input />',
			'ui/stats.svelte': '<h1>Stats</h1>',
			'ui/icons/lucide/palette.svg': SVG
		};
		const bundle = (extra: Record<string, string>) =>
			parseBundle(
				serializeBundle({
					format: 'pouchbase-plugin-bundle',
					bundleVersion: 1,
					manifest: manifest as never,
					files: { ...files, ...extra }
				})
			);

		expect(bundle({ 'ui/stats.svg': SVG }).success).toBe(true);
		expect(bundle({})).toMatchObject({
			success: false,
			issues: [{ path: 'files', message: 'Missing file: ui/stats.svg' }]
		});
		expect(bundle({ 'ui/stats.svg': '<svg><script></script></svg>' })).toMatchObject({
			success: false,
			issues: [
				{
					path: 'files.ui/stats.svg',
					message: 'The icon has a <script>; icons are images and run no code'
				}
			]
		});
	});
});
