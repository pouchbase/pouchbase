import { mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { discoverProject } from '../src/cli/discover/index.js';
import { initProject } from '../src/cli/init.js';
import { buildBundle } from '../src/cli/project.js';
import { SDK_ROOT, dir, project, write, capture, pluginFile, useTempDir } from './cli-helpers.js';

useTempDir();

describe('discoverProject: UI files', () => {
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
});
