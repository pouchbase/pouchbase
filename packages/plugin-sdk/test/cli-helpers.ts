import type { PluginBundle } from '../src/bundle.js';
import type { TEMPLATES } from '../src/cli/templates/index.js';
import type { ServerDefinition } from '../src/server.js';

import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach } from 'vitest';

import { initProject } from '../src/cli/init.js';
import { createLogger } from '../src/cli/output.js';

/** Helpers for the CLI tests: plugin projects in a temporary folder. */

export const SDK_ROOT = resolve(import.meta.dirname, '..');
export const DEMO_ROOT = resolve(import.meta.dirname, '../../../examples/plugin-demo');
const SVELTE_ROOT = realpathSync(resolve(import.meta.dirname, '../../../node_modules/svelte'));

/** The temporary folder of the current test; see `useTempDir`. */
export let dir: string;

/** Gives every test of the file a new, empty `dir`, removed after the test. */
export function useTempDir() {
	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'pouchbase-plugin-'));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});
}

/**
 * A new plugin in `dir`, with this SDK linked in as its dependency so the server code bundles, and
 * the repository's Svelte so the components compile.
 */
export async function project(id: string, template: (typeof TEMPLATES)[number]) {
	const { root } = await initProject(join(dir, id), { template });

	await mkdir(join(root, 'node_modules', '@pouchbasejs'), { recursive: true });
	await symlink(SDK_ROOT, join(root, 'node_modules', '@pouchbasejs', 'plugin-sdk'), 'junction');
	await symlink(SVELTE_ROOT, join(root, 'node_modules', 'svelte'), 'junction');

	return root;
}

/** Writes files into a plugin, creating their folders. */
export async function write(root: string, files: Record<string, string>) {
	for (const [path, contents] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), contents);
	}
}

/** `pouchbase-plugin.json` as written, without defaults. */
export type ManifestJson = Record<string, unknown> & { contributes: Record<string, unknown[]> };

export async function readJson(path: string) {
	return JSON.parse(await readFile(path, 'utf8')) as ManifestJson;
}

/** A logger that writes into arrays of lines, without colors. */
export function capture() {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const stream = (lines: string[]) => ({ write: (text: string) => lines.push(text.trimEnd()) });
	const log = createLogger({ color: false, stdout: stream(stdout), stderr: stream(stderr) });

	return { log, stdout, stderr };
}

/** A plugin whose manifest lists its contributions and server code, which the CLI generates. */
export async function manifestOnlyProject(id = 'manifest-only') {
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
export function pluginFile(imports: string, definition: string) {
	return `import { definePlugin } from '@pouchbasejs/plugin-sdk/server';
${imports}
export default definePlugin(${definition});
`;
}

/** The server code of a bundle, run in Node.js: what the host runs. */
export async function serverDefinition(bundle: PluginBundle) {
	const url = `data:text/javascript;base64,${Buffer.from(bundle.files['server.js']!).toString('base64')}`;

	return ((await import(url)) as { default: ServerDefinition }).default;
}
