import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { askTemplate, initProject, parseTemplate } from '../src/cli/init.js';
import { buildBundle } from '../src/cli/project.js';
import { TEMPLATES } from '../src/cli/templates/index.js';
import { dir, project, readJson, serverDefinition, useTempDir } from './cli-helpers.js';

useTempDir();

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
			collections: [],
			functions: []
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
