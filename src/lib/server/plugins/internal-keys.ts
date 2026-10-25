import { generateToken } from '../crypto';

/**
 * Keys for the `ctx.pouch` of built-in plugins, which run inside Pouchbase (`InProcessRuntime`).
 * Their requests go to the records API with `event.fetch`, which SvelteKit handles in the same
 * isolate without a network request, so a key only has to be known to this isolate: one random
 * key per plugin, kept in memory and never stored or sent anywhere. `requestAccess` turns it into
 * the plugin's grant, like the key of an installed plugin's Worker.
 */

/** Prefix of these keys, so `requestAccess` tells them from API keys and user tokens. */
export const INTERNAL_PLUGIN_KEY_PREFIX = 'pbi_';

const keys = new Map<string, string>();
const plugins = new Map<string, string>();

/** The key of the built-in plugin `pluginId` in this isolate. */
export function internalKeyFor(pluginId: string): string {
	let key = plugins.get(pluginId);

	if (!key) {
		key = `${INTERNAL_PLUGIN_KEY_PREFIX}${generateToken()}`;
		plugins.set(pluginId, key);
		keys.set(key, pluginId);
	}

	return key;
}

/** The plugin of a key from `internalKeyFor`, or `null` for any other token. */
export function internalPluginKey(token: string): string | null {
	return keys.get(token) ?? null;
}
