/**
 * Starts the development instance of the plugin registry: the Pouchbase app from this repository
 * in Vite's dev server, as its own instance (`registry-dev` by default), next to the one
 * `pnpm dev:app` runs. It runs the current code, so changes to Pouchbase reach it right away, like
 * they reach `pnpm dev:app`. The site's dev server (`pnpm dev:site`) talks to it when
 * `site/.env.development.local` points at it; see README.md.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// The CLI of the app's own Vite; `vite/bin/...` isn't exported, its package.json is.
const require = createRequire(join(root, 'package.json'));
const vitePackage = require.resolve('vite/package.json');
const vite = join(dirname(vitePackage), require(vitePackage).bin.vite);

if (!existsSync('.env')) {
	// `pnpm dev` starts every `dev:` script, so this stays quiet for people who don't need it.
	console.log('[registry] No registry/.env; copy registry/.env.example to start the dev registry.');
	process.exit(0);
}

// Variables already in the environment win over the root `.env`, which the app reads as well.
process.loadEnvFile('.env');
process.env.POUCHBASE_INSTANCE ||= 'registry-dev';
process.env.PORT ||= '5175';
// Generated files, Vite's cache and Miniflare's state apart from `pnpm dev:app` (see vite.config.ts).
process.env.POUCHBASE_DEV_DIR = 'node_modules/.pouchbase-registry';

console.log(
	`[registry] ${process.env.POUCHBASE_INSTANCE} on http://localhost:${process.env.PORT} (the registry API is the site: http://localhost:5174/v1)`
);

const child = spawn(process.execPath, [vite, 'dev', '--port', process.env.PORT, '--strictPort'], {
	cwd: root,
	stdio: 'inherit'
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => child.kill(signal));
}

child.on('exit', (code) => process.exit(code ?? 0));
