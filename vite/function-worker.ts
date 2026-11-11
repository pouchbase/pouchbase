import type { Plugin } from 'vite';

import { resolve } from 'node:path';
import { rolldown } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

import { bundleWorkerModule } from './plugin-worker.ts';

/**
 * What every function shares, generated from the sources so it needs no build first; in dev, a
 * change in any of them generates it again:
 *
 * - `virtual:pouchbase/function-worker`: `entry`, `src/lib/server/function-worker/pouchbase.ts`
 *   bundled with the JS SDK inside, as a string. Its import of `./function.js`, the function's own
 *   code, stays an import.
 * - `virtual:pouchbase/function-typings`: `sdkTypings`, the JS SDK's declarations as
 *   `declare module '@pouchbasejs/js-sdk'`, for the code editor (`function-worker/typings.ts`).
 */

const WORKER_ID = 'virtual:pouchbase/function-worker';
const TYPINGS_ID = 'virtual:pouchbase/function-typings';

const ENTRY_FILE = 'src/lib/server/function-worker/pouchbase.ts';
const SDK_DIR = 'packages/js-sdk';

/** The module that stays an import: uploaded next to the entry. */
const EXTERNAL = new Set(['./function.js']);

/** The SDK's declarations as one ambient module; `declare` isn't allowed inside one. */
async function sdkDeclarations(root: string, watch: (module: string) => void) {
	const build = await rolldown({
		input: resolve(root, SDK_DIR, 'src/index.ts'),
		platform: 'neutral',
		logLevel: 'silent',
		plugins: [dts({ emitDtsOnly: true, tsconfig: resolve(root, SDK_DIR, 'tsconfig.json') })]
	});
	const { output } = await build.generate({ format: 'esm' });

	await build.close();

	const [chunk] = output;

	for (const module of chunk.moduleIds) {
		watch(module);
	}

	const body = chunk.code.replace(/^(export )?declare /gm, '$1');

	return `declare module '@pouchbasejs/js-sdk' {\n${body}\n}\n`;
}

export function functionWorker(): Plugin {
	let root = process.cwd();

	return {
		name: 'pouchbase:function-worker',
		configResolved(config) {
			root = config.root;
		},
		resolveId(id) {
			return id === WORKER_ID || id === TYPINGS_ID ? `\0${id}` : undefined;
		},
		async load(id) {
			const watch = (module: string) => this.addWatchFile(module);

			if (id === `\0${WORKER_ID}`) {
				const entry = await bundleWorkerModule(resolve(root, ENTRY_FILE), EXTERNAL, watch);

				return `export const entry = ${JSON.stringify(entry)};\n`;
			}

			if (id === `\0${TYPINGS_ID}`) {
				const sdkTypings = await sdkDeclarations(root, watch);

				return `export const sdkTypings = ${JSON.stringify(sdkTypings)};\n`;
			}

			return undefined;
		}
	};
}
