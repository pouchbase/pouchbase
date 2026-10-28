import type { PluginBundle } from '../src/bundle.js';

import { sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseBundle } from '../src/bundle.js';
import { withDevVersion } from '../src/cli/dev-server.js';
import { printManifest } from '../src/cli/manifest-command.js';
import { generateServerEntry } from '../src/cli/server-entry.js';
import { parseManifest } from '../src/manifest.js';
import { dir, project, capture, useTempDir } from './cli-helpers.js';

useTempDir();

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
