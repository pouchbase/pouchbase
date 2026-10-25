import type { Plugin } from 'vite';

import { resolve } from 'node:path';
import { rolldown } from 'rolldown';

/**
 * `virtual:pouchbase/js-sdk-module`: the JS SDK (`packages/js-sdk`) bundled into one ES module
 * without imports, as a string (its default export). The Worker of an installed plugin gets it as a
 * module of its own (`src/lib/server/plugins/worker.ts`), so `ctx.pouch` is the SDK of this
 * Pouchbase, whatever SDK the plugin was built with. Bundled from the sources, so it needs no build
 * of the SDK first; in dev, a change in the SDK bundles it again.
 */

export const JS_SDK_MODULE_ID = 'virtual:pouchbase/js-sdk-module';
const RESOLVED_ID = `\0${JS_SDK_MODULE_ID}`;

export type JsSdkModuleOptions = {
	/** The SDK's entry, relative to the Vite root. Defaults to `packages/js-sdk/src/index.ts`. */
	entry?: string;
};

export function jsSdkModule(options: JsSdkModuleOptions = {}): Plugin {
	let root = process.cwd();

	return {
		name: 'pouchbase:js-sdk-module',
		configResolved(config) {
			root = config.root;
		},
		resolveId(id) {
			return id === JS_SDK_MODULE_ID ? RESOLVED_ID : undefined;
		},
		async load(id) {
			if (id !== RESOLVED_ID) {
				return undefined;
			}

			const build = await rolldown({
				input: resolve(root, options.entry ?? 'packages/js-sdk/src/index.ts'),
				platform: 'neutral',
				logLevel: 'silent'
			});
			const { output } = await build.generate({ format: 'esm', minify: true });

			await build.close();

			const [chunk] = output;

			for (const file of chunk.moduleIds) {
				this.addWatchFile(file);
			}

			return `export default ${JSON.stringify(chunk.code)};`;
		}
	};
}
