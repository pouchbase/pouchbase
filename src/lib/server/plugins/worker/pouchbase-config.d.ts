import type { PluginManifest } from '@pouchbasejs/plugin-sdk';

/**
 * `pouchbase-config.js` of a plugin's Worker: generated per plugin when it is deployed
 * (`workerModules` in `worker.ts`), as a module of data. The entry and the guard import it.
 */
export type WorkerConfig = {
	plugin: Pick<PluginManifest, 'id' | 'version' | 'settings'>;
	/** `permissions.network` of the manifest. */
	network: readonly string[];
};

declare const config: WorkerConfig;

export default config;
