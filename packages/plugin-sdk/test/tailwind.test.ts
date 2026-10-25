import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { classCandidates, compileTailwind } from '../src/cli/tailwind.js';

const UI_ROOT = resolve(import.meta.dirname, '../../ui');

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'pouchbase-tailwind-'));
	await writeFile(join(dir, 'package.json'), '{}');
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

/** Links `@pouchbasejs/ui` into the project, as its devDependency would. */
async function withUi() {
	await mkdir(join(dir, 'node_modules', '@pouchbasejs'), { recursive: true });
	await symlink(UI_ROOT, join(dir, 'node_modules', '@pouchbasejs', 'ui'), 'junction');
}

describe('classCandidates', () => {
	it('finds the classes in attributes, arrays, templates and directives', () => {
		const candidates = classCandidates(
			'<div class="flex gap-2" class:hidden={x}><span class={[\'p-1\', ok && "text-sm"]}>`m-${n} h-control`</span></div>'
		);

		for (const name of ['flex', 'gap-2', 'hidden', 'p-1', 'text-sm', 'h-control']) {
			expect(candidates).toContain(name);
		}
	});

	it('keeps variants and arbitrary values whole', () => {
		const candidates = classCandidates(
			'<b class="data-[state=open]:border-zinc-900 max-h-[min(18rem,calc(100%-2px))]"></b>'
		);

		expect(candidates).toContain('data-[state=open]:border-zinc-900');
		expect(candidates).toContain('max-h-[min(18rem,calc(100%-2px))]');
	});
});

describe('compileTailwind', () => {
	it('compiles the classes of the components with the dashboard tokens', async () => {
		await withUi();

		const { css, classes, warnings } = await compileTailwind(dir, {
			'ui/fields/a/input.svelte': '<div class="flex h-control hover:bg-zinc-100">Hi</div>',
			'ui/lib/a.js': "export const cls = 'text-chart-1';"
		});

		expect(warnings).toEqual([]);
		expect(classes).toBeGreaterThanOrEqual(4);
		expect(css).toContain('.flex');
		expect(css).toContain('.h-control');
		expect(css).toContain('--spacing-control');
		expect(css).toContain('--color-chart-1');
		expect(css).toContain('@layer utilities');
		// Never the base styles: the dashboard has them.
		expect(css).not.toContain('box-sizing: border-box');
	});

	it('generates nothing without classes or components', async () => {
		await withUi();

		expect(await compileTailwind(dir, { 'ui/a.svelte': '<p>Just text</p>' })).toMatchObject({
			css: null
		});
		expect(await compileTailwind(dir, { 'ui/icon.svg': '<svg class="flex"></svg>' })).toEqual({
			css: null,
			classes: 0,
			warnings: []
		});
	});

	it('falls back to the default theme with a @pouchbasejs/ui without tokens', async () => {
		// An older @pouchbasejs/ui, from before tokens.css.
		const ui = join(dir, 'node_modules', '@pouchbasejs', 'ui');

		await mkdir(ui, { recursive: true });
		await writeFile(
			join(ui, 'package.json'),
			JSON.stringify({ name: '@pouchbasejs/ui', exports: { './theme.css': './theme.css' } })
		);

		const { css, warnings } = await compileTailwind(dir, {
			'ui/a.svelte': '<div class="flex h-control"></div>'
		});

		expect(css).toContain('.flex');
		expect(css).not.toContain('--spacing-control:');
		expect(warnings).toEqual([
			expect.objectContaining({
				path: 'package.json',
				message: expect.stringContaining('@pouchbasejs/ui')
			})
		]);
	});
});
