/**
 * Generates `src/lib/server/pouchbase.types.ts`, the types of the instance's collections, with the
 * same `POUCHBASE_URL` and `POUCHBASE_API_KEY` as `pnpm dev`: `.env.development.local` on top
 * of `.env`. Run it with `pnpm types` after changing the collections.
 *
 * It sends the request itself, as `pouch.schema.types()` of the SDK does: in this workspace the SDK
 * resolves to its TypeScript source, which Node can't run.
 */
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const OUT = 'src/lib/server/pouchbase.types.ts';

// `loadEnvFile` keeps variables that are already set, so the first file wins over the next, and
// the environment over both.
for (const file of ['.env.development.local', '.env']) {
	if (existsSync(file)) {
		process.loadEnvFile(file);
	}
}

const { POUCHBASE_URL: url, POUCHBASE_API_KEY: apiKey } = process.env;

if (!url || !apiKey) {
	console.error('Set POUCHBASE_URL and POUCHBASE_API_KEY, e.g. in .env (see .env.example).');
	process.exit(1);
}

const response = await fetch(new URL('/api/types', url), {
	headers: { Accept: 'text/plain, application/json', Authorization: `Bearer ${apiKey}` }
});
const body = await response.text();

if (!response.ok) {
	console.error(`Could not download the types (${response.status}): ${body}`);
	process.exit(1);
}

await writeFile(OUT, body);
console.log(`Wrote the types of ${url} to ${OUT}`);
