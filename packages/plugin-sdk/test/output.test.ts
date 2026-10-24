import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { initProject } from '../src/cli/init.js';
import { CliError, createLogger, type LoggerOptions } from '../src/cli/output.js';
import { ProjectError, buildBundle } from '../src/cli/project.js';
import { RegistryError, createRegistryClient } from '../src/registry.js';

/** A logger that writes into arrays of lines, without colors. */
function capture(options: LoggerOptions = {}) {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const stream = (lines: string[]) => ({ write: (text: string) => lines.push(text.trimEnd()) });
	const log = createLogger({
		color: false,
		...options,
		stdout: stream(stdout),
		stderr: stream(stderr)
	});

	return { log, stdout, stderr };
}

describe('createLogger', () => {
	it('prints steps, details, results and next steps', () => {
		const { log, stdout } = capture();

		log.step('Reading pouchbase-plugin.json');
		log.detail('demo@1.0.0');
		log.debug('only with --verbose');
		log.success('Done');
		log.next('publish it.');

		expect(stdout).toEqual([
			'› Reading pouchbase-plugin.json',
			'  demo@1.0.0',
			'✓ Done',
			'  Next: publish it.'
		]);
	});

	it('only prints results, warnings and errors when quiet', () => {
		const { log, stdout, stderr } = capture({ quiet: true });

		log.step('Reading');
		log.detail('detail');
		log.next('next');
		log.success('Done');
		log.warnings([{ path: 'ui/a.svelte', message: 'Unused' }]);

		expect(stdout).toEqual(['✓ Done']);
		expect(stderr).toEqual(['! ui/a.svelte: Unused']);
	});

	it('prints errors with their issues and a hint', () => {
		const { log, stderr } = capture();

		log.error(
			new ProjectError('pouchbase-plugin.json is not valid', [{ path: 'id', message: 'Required' }])
		);
		log.error(new CliError('Port 4510 is already in use', 'Pass another port with --port.'));
		log.error(new RegistryError(409, 'version_exists', 'Version 1.0.0 already exists'));

		expect(stderr).toEqual([
			'✗ pouchbase-plugin.json is not valid',
			'  id: Required',
			'✗ Port 4510 is already in use',
			'  Hint: Pass another port with --port.',
			'✗ Version 1.0.0 already exists',
			'  Hint: Every version can be published once: raise "version" in package.json (or pouchbase-plugin.json) and publish again.'
		]);
	});

	it('suggests --verbose for unexpected errors and shows the stack with it', () => {
		const quiet = capture();
		const verbose = capture({ verbose: true });

		quiet.log.error(new Error('boom'));
		verbose.log.error(new Error('boom'));

		expect(quiet.stderr).toEqual(['✗ boom', '  Run again with --verbose for the stack trace.']);
		expect(verbose.stderr[0]).toBe('✗ boom');
		expect(verbose.stderr[1]).toMatch(/^Error: boom\n\s+at /);
	});

	it('colors only when asked to', () => {
		const stdout: string[] = [];
		const log = createLogger({ color: true, stdout: { write: (text) => stdout.push(text) } });

		log.success('Done');

		expect(stdout[0]).toBe('\x1b[32m✓\x1b[0m Done\n');
	});
});

describe('feedback', () => {
	let root: string | undefined;

	afterEach(async () => {
		if (root) {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('reports the steps of a build', async () => {
		root = await mkdtemp(join(tmpdir(), 'pouchbase-plugin-'));

		const { root: project } = await initProject(join(root, 'demo-page'), { template: 'page' });
		const { log, stdout } = capture();

		await buildBundle(project, { log }).catch(() => {});

		expect(stdout.slice(0, 4)).toEqual([
			'› Reading pouchbase-plugin.json',
			expect.stringMatching(/^ {2}demo-page@0\.1\.0 \(API version \d+\), contributes 1 page$/),
			'› Checking ui/',
			expect.stringMatching(/^ {2}\d+ files?/)
		]);
	});

	it('names the reason when the registry is unreachable', async () => {
		const client = createRegistryClient({
			url: 'http://registry.test',
			fetch: () => Promise.reject(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }))
		});

		await expect(client.get('demo')).rejects.toThrow(
			'Registry unreachable at http://registry.test: ENOTFOUND'
		);
	});
});
