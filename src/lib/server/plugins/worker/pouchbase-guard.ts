import { hostMatches } from '@pouchbasejs/plugin-sdk';

import { restrictedFetch } from '../network';
import config from './pouchbase-config.js';

/**
 * `pouchbase-guard.js` of a plugin's Worker: imported first by the entry (`pouchbase.ts`), so it
 * runs before any plugin code, it replaces `globalThis.fetch` and `WebSocket` with versions limited
 * to the manifest's `permissions.network`. On Workers the replacements are locked; elsewhere
 * (tests) `restoreGlobals` puts the originals back. Bundled by `vite/plugin-worker.ts`.
 */

const upstreamFetch = globalThis.fetch;
const UpstreamWebSocket = globalThis.WebSocket;
const locked = globalThis.navigator?.userAgent === 'Cloudflare-Workers';

/** `ctx.fetch`: the hosts of `permissions.network`, over HTTPS. */
export const pluginFetch = restrictedFetch(config.network, upstreamFetch);

/** The fetch of `ctx.pouch`: only the origin of Pouchbase, which `permissions.network` doesn't cover. */
export function originFetch(origin: string): typeof fetch {
	return (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);

		if (new URL(request.url).origin !== origin) {
			throw new TypeError(`ctx.pouch only reaches ${origin}`);
		}

		return upstreamFetch(new Request(request, { redirect: 'manual' }));
	}) as typeof fetch;
}

/** Why a WebSocket to `url` may not be opened, or `null` when it may. */
function socketBlockedReason(url: URL) {
	if (url.protocol !== 'wss:') {
		return `Only wss URLs can be opened: ${url.href}`;
	}

	if (!config.network.some((pattern) => hostMatches(url.hostname, pattern))) {
		return `${url.hostname} is not in permissions.network`;
	}

	return null;
}

function replace(name: 'fetch' | 'WebSocket', value: unknown) {
	Object.defineProperty(globalThis, name, {
		value,
		writable: !locked,
		configurable: !locked,
		enumerable: false
	});
}

replace('fetch', pluginFetch);

if (typeof UpstreamWebSocket === 'function') {
	replace(
		'WebSocket',
		class WebSocket extends UpstreamWebSocket {
			constructor(url: string | URL, protocols?: string | string[]) {
				const reason = socketBlockedReason(new URL(url));

				if (reason) {
					throw new TypeError(reason);
				}

				super(url, protocols);
			}
		}
	);
}

export function restoreGlobals() {
	if (!locked) {
		replace('fetch', upstreamFetch);

		if (typeof UpstreamWebSocket === 'function') {
			replace('WebSocket', UpstreamWebSocket);
		}
	}
}
