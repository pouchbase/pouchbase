import type { EmbeddedPlugin } from './embedded';
import type { DescribeResult, PluginRuntime } from './protocol';
import type { InstalledRow, PluginSource, SavedSettings } from './sources';

import { Pouchbase } from '@pouchbasejs/js-sdk';
import { SERVER_FILE } from '@pouchbasejs/plugin-sdk';
import { asc, eq } from 'drizzle-orm';

import { db, pluginBundleParts } from '../db';
import { embeddedPlugin } from './embedded';
import { describeEmbedded, InProcessRuntime, installedInProcess } from './in-process';
import { RUN_INSTALLED_IN_PROCESS } from './install';
import { internalKeyFor } from './internal-keys';
import { callContext } from './sources';
import { WorkerRuntime } from './worker';

/**
 * Where a plugin's server code runs for a request: its Worker when installed, Pouchbase itself
 * when built in (or installed in development), and what the host knows it implements.
 */

/** The `server.js` of installed plugins that run in process (in dev), by plugin and update. */
const storedServers = new Map<string, Promise<string | null>>();

/** The files of an installed plugin's stored bundle; `null` when it isn't installed. */
export async function storedFiles(pluginId: string): Promise<Record<string, string> | null> {
	const parts = await db
		.select({ data: pluginBundleParts.data })
		.from(pluginBundleParts)
		.where(eq(pluginBundleParts.pluginId, pluginId))
		.orderBy(asc(pluginBundleParts.part));

	if (!parts.length) {
		return null;
	}

	const bundle = parts.map((part) => part.data).join('');

	return (JSON.parse(bundle) as { files?: Record<string, string> }).files ?? {};
}

/** The `server.js` of an installed plugin's stored bundle, read once per install or update. */
function storedServer(row: InstalledRow) {
	const key = `${row.id}:${row.updatedAt.getTime()}`;
	let code = storedServers.get(key);

	if (!code) {
		code = storedFiles(row.id).then((files) => files?.[SERVER_FILE] ?? null);
		code.catch(() => storedServers.delete(key));
		storedServers.set(key, code);
	}

	return code;
}

export class PluginRuntimes {
	/**
	 * @param origin - The origin of this Pouchbase, for the `ctx.pouch` of plugins that run inside it
	 * @param fetch - The request's `event.fetch`: it handles requests to Pouchbase itself in this
	 *   isolate, without the network
	 */
	constructor(
		readonly origin: string,
		private readonly fetch: typeof globalThis.fetch
	) {}

	/** The runtime of a plugin, without settings bound; `null` without server code. */
	of(source: PluginSource): PluginRuntime | null {
		const { row } = source;

		if (row) {
			if (RUN_INSTALLED_IN_PROCESS) {
				return row.manifest.server
					? this.inProcess(installedInProcess(row.manifest, () => storedServer(row)))
					: null;
			}

			return row.workerUrl && row.workerSecret
				? new WorkerRuntime(row.workerUrl, row.workerSecret)
				: null;
		}

		const plugin = embeddedPlugin(source.manifest.id);

		return plugin?.manifest.server ? this.inProcess(plugin) : null;
	}

	/** Runs a plugin's server code inside Pouchbase: a built-in one, or an installed one in dev. */
	inProcess(plugin: EmbeddedPlugin) {
		// With a key that only this isolate knows.
		const pouch = new Pouchbase(this.origin, {
			fetch: this.fetch,
			headers: { authorization: `Bearer ${internalKeyFor(plugin.manifest.id)}` }
		});

		return new InProcessRuntime(plugin, { pouch });
	}

	/**
	 * What the plugin's server code implements: stored on install, or asked of a built-in plugin
	 * (kept per build). `null` without server code. A built-in plugin that can't describe itself
	 * counts as one without capabilities.
	 */
	async capabilities(source: PluginSource, saved: SavedSettings): Promise<DescribeResult | null> {
		if (source.row) {
			return source.row.capabilities ?? null;
		}

		const plugin = embeddedPlugin(source.manifest.id);

		if (!plugin?.manifest.server) {
			return null;
		}

		try {
			return await describeEmbedded(
				plugin,
				callContext(plugin.manifest, saved.get(plugin.manifest.id) ?? {})
			);
		} catch (error) {
			console.error(
				`[plugins] The built-in ${plugin.manifest.id} could not describe itself`,
				error
			);

			return null;
		}
	}
}
