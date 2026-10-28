import type { Plugin } from 'vite';

import { resolve } from 'node:path';
import { rolldown } from 'rolldown';

/**
 * `virtual:pouchbase/plugin-worker`: the modules of a plugin's Worker that are the same for every
 * plugin, bundled from `src/lib/server/plugins/worker/` into ES modules without imports (the JS
 * SDK and the plugin SDK included), as strings:
 *
 * - `entry`: `pouchbase.ts`, which answers Pouchbase's calls and route requests;
 * - `guard`: `pouchbase-guard.ts`, which limits `fetch` and `WebSocket` to the plugin's network.
 *
 * They import the generated `./pouchbase-config.js` (the manifest's part the Worker needs), each
 * other and the plugin's `./plugin.js`, which stay imports: `workerModules` in
 * `src/lib/server/plugins/worker.ts` puts the four modules together. Bundled from the sources, so
 * it needs no build first; in dev, a change in any of them bundles again.
 */

export const PLUGIN_WORKER_ID = 'virtual:pouchbase/plugin-worker';
const RESOLVED_ID = `\0${PLUGIN_WORKER_ID}`;

const WORKER_DIR = 'src/lib/server/plugins/worker';

/** The modules of the Worker that stay imports: generated per plugin, or bundled on their own. */
const EXTERNAL = new Set(['./pouchbase-config.js', './pouchbase-guard.js', './plugin.js']);

export function pluginWorker(): Plugin {
	let root = process.cwd();

	return {
		name: 'pouchbase:plugin-worker',
		configResolved(config) {
			root = config.root;
		},
		resolveId(id) {
			return id === PLUGIN_WORKER_ID ? RESOLVED_ID : undefined;
		},
		async load(id) {
			if (id !== RESOLVED_ID) {
				return undefined;
			}

			const bundle = async (file: string) => {
				const build = await rolldown({
					input: resolve(root, WORKER_DIR, file),
					platform: 'neutral',
					external: (specifier) => EXTERNAL.has(specifier),
					logLevel: 'silent'
				});
				const { output } = await build.generate({ format: 'esm', minify: true });

				await build.close();

				const [chunk] = output;

				for (const module of chunk.moduleIds) {
					this.addWatchFile(module);
				}

				return chunk.code;
			};

			const [entry, guard] = await Promise.all([
				bundle('pouchbase.ts'),
				bundle('pouchbase-guard.ts')
			]);

			return `export const entry = ${JSON.stringify(entry)};\nexport const guard = ${JSON.stringify(guard)};\n`;
		}
	};
}
