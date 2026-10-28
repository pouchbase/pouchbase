import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MANIFEST_FILE } from '../../manifest.js';
import { isObject } from '../project.js';
import { ProjectError } from '../project-error.js';

/** Folders never read, wherever they are. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage']);

/** Every file of the project as a POSIX path, without `node_modules`, `dist` and dot folders. */
export async function projectFiles(root: string): Promise<string[]> {
	const files: string[] = [];

	async function walk(dir: string, prefix: string) {
		const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => []);

		for (const entry of entries) {
			const path = prefix + entry.name;

			if (entry.isDirectory()) {
				if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
					await walk(path, `${path}/`);
				}
			} else if (entry.isFile()) {
				files.push(path);
			}
		}
	}

	await walk('', '');

	return files.sort();
}

/** The parsed `pouchbase-plugin.json`, as written. */
export async function readManifestJson(root: string): Promise<Record<string, unknown>> {
	let json: unknown;

	try {
		json = JSON.parse(await readFile(join(root, MANIFEST_FILE), 'utf8'));
	} catch (error) {
		throw new ProjectError(
			`Can't read ${MANIFEST_FILE}: ${(error as Error).message}`,
			[],
			(error as NodeJS.ErrnoException).code === 'ENOENT'
				? 'Run the command in the folder of a plugin, or create one with pouchbase-plugin init.'
				: undefined
		);
	}

	if (!isObject(json)) {
		throw new ProjectError(`${MANIFEST_FILE} must be a JSON object`);
	}

	return json;
}
