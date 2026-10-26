import type { PluginManifest } from '@pouchbasejs/plugin-sdk';
import type { ServerDefinition } from '@pouchbasejs/plugin-sdk/server';
import type { EmbeddedPlugin } from './embedded';

import { dev } from '$app/env';

/**
 * In development (`vite dev`), installed plugins run their server code inside Pouchbase, like the
 * built-in plugins (`InProcessRuntime`), instead of in a Worker of their own: a Worker on
 * Cloudflare can't reach a Pouchbase on `localhost`, so its `ctx.pouch` would always fail, and
 * skipping the deploy makes installing much faster. The code runs without the Worker's sandbox,
 * so only install plugins you trust while developing; builds always deploy Workers.
 */
export const RUN_INSTALLED_IN_PROCESS = dev;

/** Imported server modules, by plugin id, version and code, so each version is imported once. */
const modules = new Map<string, Promise<ServerDefinition | undefined>>();

/** A short hash of the code (FNV-1a), so a rebuilt plugin with the same version is imported again. */
function hash(code: string) {
	let value = 0x811c9dc5;

	for (let i = 0; i < code.length; i++) {
		value = Math.imul(value ^ code.charCodeAt(i), 0x01000193);
	}

	return (value >>> 0).toString(36);
}

/** Imports the bundled `server.js` of a plugin, which imports nothing and default-exports it all. */
function importServer(key: string, code: string) {
	let module = modules.get(key);

	if (!module) {
		const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;

		module = import(/* @vite-ignore */ url).then(
			(loaded: { default?: ServerDefinition }) => loaded.default,
			(error: unknown) => {
				modules.delete(key);

				throw error;
			}
		);
		modules.set(key, module);
	}

	return module;
}

/**
 * An installed plugin as `InProcessRuntime` runs it: `code` is its `server.js`, or reads it from
 * the stored bundle when it is first needed (`null` when there is none).
 */
export function installedInProcess(
	manifest: PluginManifest,
	code: string | (() => Promise<string | null>)
): EmbeddedPlugin {
	return {
		manifest,
		assets: {},
		async load() {
			const source = typeof code === 'string' ? code : await code();

			if (source === null) {
				throw new Error(`The server code of ${manifest.id} is not stored`);
			}

			return importServer(`${manifest.id}@${manifest.version}:${hash(source)}`, source);
		}
	};
}
