#!/usr/bin/env node
/**
 * The `pouchbase` command (Node only; the rest of the SDK runs everywhere):
 *
 * ```sh
 * pouchbase types <url> [--out src/pouchbase.ts]
 * pouchbase types <instance url> --api-key pbk_… [--out src/pouchbase.ts]
 * ```
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { Pouchbase } from './client.js';
import { PouchbaseError } from './error.js';
import { fetchTypes } from './typegen.js';

const USAGE = `Usage: pouchbase types [url] [--api-key <key>] [--out <file>]

Downloads the TypeScript types of your collections. Copy the URL from the Types page of the
Pouchbase admin, or set POUCHBASE_TYPES_URL. With an API key (--api-key or
POUCHBASE_API_KEY), pass the URL of the instance instead, or set POUCHBASE_URL.

Options:
  -k, --api-key <key>  An API key, instead of the token in the URL
  -o, --out <file>     Write the types to this file instead of printing them
  -h, --help           Show this help`;

/** Runs the command line; returns the exit code. */
async function main(argv: string[]): Promise<number> {
	let parsed;

	try {
		parsed = parseArgs({
			args: argv,
			allowPositionals: true,
			options: {
				'api-key': { type: 'string', short: 'k' },
				out: { type: 'string', short: 'o' },
				help: { type: 'boolean', short: 'h' }
			}
		});
	} catch (error) {
		console.error(`${(error as Error).message}\n\n${USAGE}`);

		return 1;
	}

	const [command, positionalUrl] = parsed.positionals;

	if (parsed.values.help || !command) {
		console.log(USAGE);

		return parsed.values.help ? 0 : 1;
	}

	if (command !== 'types') {
		console.error(`Unknown command: ${command}\n\n${USAGE}`);

		return 1;
	}

	const apiKey = parsed.values['api-key'] ?? process.env.POUCHBASE_API_KEY;
	const url =
		positionalUrl ?? (apiKey ? process.env.POUCHBASE_URL : process.env.POUCHBASE_TYPES_URL);

	if (!url) {
		const hint = apiKey
			? 'Pass the URL of the instance, or set POUCHBASE_URL.'
			: 'Pass the URL from the Types page, or set POUCHBASE_TYPES_URL.';

		console.error(`${hint}\n\n${USAGE}`);

		return 1;
	}

	if (!apiKey && !isTypesUrl(url)) {
		console.error(
			`${url} is not the URL from the Types page (…/api/types?token=…). For the URL of the instance, pass an API key with --api-key or POUCHBASE_API_KEY.\n\n${USAGE}`
		);

		return 1;
	}

	let code: string;

	try {
		code = apiKey ? await new Pouchbase(url, { apiKey }).schema.types() : await fetchTypes(url);
	} catch (error) {
		const status = error instanceof PouchbaseError && error.status ? ` (${error.status})` : '';

		console.error(`Could not download the types${status}: ${(error as Error).message}`);

		return 1;
	}

	if (!parsed.values.out) {
		process.stdout.write(code);

		return 0;
	}

	const file = resolve(parsed.values.out);

	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, code);
	console.error(`Wrote the types to ${parsed.values.out}`);

	return 0;
}

/** Whether `url` points at `GET /api/types`, as the URL on the Types page does. */
function isTypesUrl(url: string): boolean {
	try {
		return new URL(url).pathname.replace(/\/+$/, '').endsWith('/api/types');
	} catch {
		return false;
	}
}

process.exitCode = await main(process.argv.slice(2));
