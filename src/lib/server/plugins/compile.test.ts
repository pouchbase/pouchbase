import { describe, expect, it } from 'vitest';

import { compileUi, formatCompileIssue, resolveRelative } from './compile';

const RATING = `<script lang="ts">
	import { stars } from './rating.js';
	import * as Button from '@pouchbasejs/ui/button';

	let { value }: { value: number | null } = $props();
	let count = $state(value ?? 0);
</script>

<p>{stars(count)}</p>
<Button.Root onclick={() => count++}>More</Button.Root>

<style>
	p {
		color: gold;
	}
</style>
`;

describe('resolveRelative', () => {
	it('resolves paths inside ui/', () => {
		expect(resolveRelative('ui/rating.svelte', './rating.js')).toBe('ui/rating.js');
		expect(resolveRelative('ui/fields/rating/input.svelte', '../../lib/stars.js')).toBe(
			'ui/lib/stars.js'
		);
	});

	it('rejects paths that leave ui/', () => {
		expect(resolveRelative('ui/rating.svelte', '../outside.js')).toBeNull();
		expect(resolveRelative('ui/a/b.svelte', '../../server.js')).toBeNull();
	});
});

describe('compileUi', () => {
	it('compiles a component for the client and normalises its relative imports', async () => {
		const result = await compileUi({
			'ui/rating.svelte': RATING,
			'ui/rating.js': 'export const stars = (count) => "*".repeat(count);',
			'ui/theme.css': '.demo { color: red; }',
			'ui/icon.svg': '<svg></svg>',
			'server.js': 'export default {};'
		});

		expect(result.issues).toEqual([]);
		expect(Object.keys(result.modules).sort()).toEqual(['ui/rating.js', 'ui/rating.svelte']);
		expect(result.css).toEqual({ 'ui/theme.css': '.demo { color: red; }' });

		const rating = result.modules['ui/rating.svelte']!;

		expect(rating.imports).toEqual(
			expect.arrayContaining(['svelte/internal/client', 'ui/rating.js', '@pouchbasejs/ui/button'])
		);
		expect(rating.imports).not.toContain('./rating.js');
		expect(rating.code).toContain("from 'ui/rating.js'");
		expect(rating.code).not.toContain('./rating.js');
		// Scoped CSS is injected by the component itself.
		expect(rating.code).toContain('gold');
		expect(result.modules['ui/rating.js']).toEqual({
			code: 'export const stars = (count) => "*".repeat(count);',
			imports: []
		});
	});

	it('does not load the compiler without .svelte files', async () => {
		await expect(compileUi({ 'server.js': 'export default {};' })).resolves.toEqual({
			modules: {},
			css: {},
			issues: []
		});
	});

	it('rejects packages that Pouchbase does not provide', async () => {
		const result = await compileUi({
			'ui/a.svelte': `<script>\n\timport _ from 'lodash';\n</script>\n<p>{_.x}</p>`
		});

		expect(result.issues).toEqual([
			expect.objectContaining({
				path: 'ui/a.svelte',
				line: 2,
				message: expect.stringContaining('Cannot import lodash')
			})
		]);
	});

	it('rejects relative imports outside ui/ and files that do not exist', async () => {
		const result = await compileUi({
			'ui/a.js': "import x from '../outside.js';\nimport y from './missing.js';\nexport { x, y };",
			'ui/b.js': "import './theme.css';",
			'ui/theme.css': ''
		});

		expect(result.issues).toEqual([
			expect.objectContaining({
				path: 'ui/a.js',
				line: 1,
				message: expect.stringContaining('outside the ui/ directory')
			}),
			expect.objectContaining({
				path: 'ui/a.js',
				line: 2,
				message: expect.stringContaining('ui/missing.js does not exist')
			}),
			expect.objectContaining({ path: 'ui/b.js', message: expect.stringContaining('.css') })
		]);
	});

	it('rejects dynamic import()', async () => {
		const result = await compileUi({
			'ui/a.js': "export const load = () => import('./b.js');",
			'ui/b.js': 'export default 1;'
		});

		expect(result.issues).toEqual([
			expect.objectContaining({
				path: 'ui/a.js',
				message: expect.stringContaining('Dynamic import()')
			})
		]);
	});

	it('reports Svelte errors with the path and the position', async () => {
		const result = await compileUi({
			'ui/broken.svelte': '<script>\n\tlet x = $state(0);\n</script>\n\n<div>{x</div>\n'
		});

		expect(result.issues).toHaveLength(1);

		const [issue] = result.issues;

		expect(issue).toMatchObject({ path: 'ui/broken.svelte', line: 5 });
		expect(issue!.message).not.toContain('svelte.dev/e/');
		expect(formatCompileIssue(issue!)).toMatch(/^ui\/broken\.svelte:5:\d+: /);
	});
});
