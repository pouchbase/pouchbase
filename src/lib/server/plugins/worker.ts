import type { PluginManifest } from '@pouchbasejs/plugin-sdk';
import type {
	PluginCall,
	PluginCallContext,
	PluginRouteContext,
	PluginRouteInfo,
	PluginRuntime
} from './protocol';

import { entry as entryCode, guard as guardCode } from 'virtual:pouchbase/plugin-worker';

import { PluginCallError, routeRequestHeaders } from './dispatch';
import { CALL_TIMEOUT, EMPTY_CALL_CONTEXT } from './protocol';
import {
	CALL_PATH,
	CONTEXT_HEADER,
	decodeCallJson,
	encodeCallJson,
	ERROR_HEADER,
	ROUTE_PATH,
	SECRET_HEADER
} from './worker/codec';

/**
 * The Worker of an installed plugin with server code: one per plugin, on the Cloudflare account,
 * deployed with the Script Upload API like the functions (`<instance>-plugin-<id>`). It has four
 * modules (`workerModules`):
 *
 * - `ENTRY_MODULE`, the main module (`worker/pouchbase.ts`): answers `POST /__call` and
 *   `/__route/<path>` with the plugin secret in `SECRET_HEADER`, and 404 to everything else;
 * - `GUARD_MODULE` (`worker/pouchbase-guard.ts`), imported first so it runs before any plugin
 *   code: replaces `globalThis.fetch` (and `WebSocket`) with versions limited to
 *   `permissions.network`;
 * - `CONFIG_MODULE`: the part of the manifest the two need, generated here per plugin;
 * - `PLUGIN_MODULE`: the plugin's bundled `server.js`.
 *
 * The entry and the guard are bundled from their sources by `vite/plugin-worker.ts`, with the JS
 * SDK (for `ctx.pouch`) and the plugin SDK inside, so a Worker runs the same `dispatch.ts` as a
 * plugin inside Pouchbase. The Worker's bindings are the secret (`POUCHBASE_PLUGIN_SECRET`), the
 * URL of Pouchbase (`POUCHBASE_URL`) and the plugin's API key (`POUCHBASE_API_KEY`). The plugin
 * gets no `env`: the entry builds `ctx.pouch` from the URL and the key, with a `fetch` that only
 * reaches that origin, and the records API decides what the key may do.
 *
 * A call is `{ call, context }` as JSON; the answer is `{ ok: true, value }` or
 * `{ ok: false, error }`. Bytes (`Uint8Array`, e.g. a BLOB field value) travel as
 * `{ [BYTES_KEY]: <base64> }` both ways (`worker/codec.ts`). A route request is the original
 * request, forwarded with its method, headers and streamed body to `/__route<path><search>`;
 * `CONTEXT_HEADER` holds `{ settings, admin, user, url }` as JSON (ASCII only). The Worker
 * rebuilds the request with the original `url`, without the cookie and the `x-pouchbase-plugin-*`
 * headers, and returns the handler's response as is; 404/405 when no route matches. When the
 * handler fails, it answers 500 `{ ok: false, error }` with `ERROR_HEADER`.
 *
 * The allowlist covers `fetch` and `WebSocket`, the APIs plugin code is meant to use. It is not a
 * full sandbox (e.g. `cloudflare:sockets` is not covered): what keeps a plugin away from Pouchbase's
 * data is that its Worker has no bindings to the database, the storage or the secrets, its API key
 * only reaches the collections it may use, and Pouchbase only sends it the call's own data.
 */

export const ENTRY_MODULE = 'pouchbase.js';
export const GUARD_MODULE = 'pouchbase-guard.js';
export const CONFIG_MODULE = 'pouchbase-config.js';
export const PLUGIN_MODULE = 'plugin.js';

export { CALL_PATH, CONTEXT_HEADER, ROUTE_PATH, SECRET_HEADER } from './worker/codec';

/**
 * `CONTEXT_HEADER` of a route request: `{ settings, admin, user, url }` as JSON, with every
 * character outside ASCII escaped (`é`) so it is a valid header value.
 */
export function routeContextHeader(context: PluginRouteContext, url: string) {
	return JSON.stringify({
		settings: context.settings,
		admin: context.admin,
		user: context.user,
		url
	}).replace(/[\u007f-￿]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Longest Worker name that still fits in a workers.dev host name label. */
const MAX_SCRIPT_NAME = 63;

/** FNV-1a, for a short stable suffix; not for security. */
function shortHash(value: string) {
	let hash = 0x811c9dc5;

	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0).toString(36).padStart(7, '0');
}

/** The plugin's Worker, prefixed with the instance so instances on one account don't clash. */
export function pluginScriptName(instance: string, pluginId: string) {
	const name = `${instance}-plugin-${pluginId}`;

	if (name.length <= MAX_SCRIPT_NAME) {
		return name;
	}

	const suffix = `-${shortHash(pluginId)}`;

	return `${name.slice(0, MAX_SCRIPT_NAME - suffix.length).replace(/-+$/, '')}${suffix}`;
}

/** The modules of a plugin's Worker, for `functions.deploy`. */
export function workerModules(
	manifest: Pick<PluginManifest, 'id' | 'version'> & {
		permissions: Pick<PluginManifest['permissions'], 'network'>;
	} & Partial<Pick<PluginManifest, 'settings'>>,
	server: string
) {
	const config = {
		plugin: { id: manifest.id, version: manifest.version, settings: manifest.settings ?? [] },
		network: manifest.permissions.network
	};

	return [
		{ name: ENTRY_MODULE, content: entryCode },
		{ name: GUARD_MODULE, content: guardCode },
		{ name: CONFIG_MODULE, content: `export default ${JSON.stringify(config)};\n` },
		{ name: PLUGIN_MODULE, content: server }
	];
}

/** Calls the plugin's Worker over its workers.dev URL. */
export class WorkerRuntime implements PluginRuntime {
	constructor(
		private readonly url: string,
		private readonly secret: string,
		private readonly options: { timeout?: number; fetch?: typeof fetch } = {}
	) {}

	async call(call: PluginCall, context: PluginCallContext = EMPTY_CALL_CONTEXT): Promise<unknown> {
		const timeout = this.options.timeout ?? CALL_TIMEOUT;
		let response: Response;

		try {
			response = await (this.options.fetch ?? fetch)(new URL(CALL_PATH, this.url), {
				method: 'POST',
				headers: { 'content-type': 'application/json', [SECRET_HEADER]: this.secret },
				body: encodeCallJson({ call, context }),
				redirect: 'manual',
				signal: AbortSignal.timeout(timeout)
			});
		} catch (error) {
			throw unreachable(error, timeout);
		}

		let body: unknown;

		try {
			body = decodeCallJson(await response.text());
		} catch {
			// workers.dev answers with a page of its own until a new Worker is reachable there.
			throw new PluginCallError(
				`The plugin's Worker answered ${response.status} without a result`,
				{ retryable: true }
			);
		}

		const result = body as { ok?: unknown; value?: unknown; error?: unknown } | null;

		if (result?.ok === true) {
			return result.value;
		}

		throw new PluginCallError(
			typeof result?.error === 'string'
				? result.error
				: `The plugin's Worker answered ${response.status} without a result`
		);
	}

	/**
	 * Forwards `request` to `/__route<path><search>` on the Worker, with its method, its headers
	 * (without the cookie) and its body as a stream. The timeout covers the time until the
	 * response starts; the body then streams as long as it takes.
	 */
	async route(
		request: Request,
		info: PluginRouteInfo,
		context: PluginRouteContext
	): Promise<Response> {
		const timeout = this.options.timeout ?? CALL_TIMEOUT;
		const url = new URL(this.url);

		url.pathname = `${ROUTE_PATH}${info.path.startsWith('/') ? info.path : `/${info.path}`}`;
		url.search = info.search;

		// `..` segments (also as `%2e%2e`) are resolved by URL; they must not leave the route prefix.
		if (!url.pathname.startsWith(`${ROUTE_PATH}/`)) {
			return Response.json({ message: 'Route not found' }, { status: 404 });
		}

		const headers = routeRequestHeaders(request.headers);

		headers.set(SECRET_HEADER, this.secret);
		headers.set(CONTEXT_HEADER, routeContextHeader(context, request.url));

		const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
		const controller = new AbortController();
		const timer = setTimeout(
			() => controller.abort(new DOMException('Timed out', 'TimeoutError')),
			timeout
		);
		let response: Response;

		try {
			response = await (this.options.fetch ?? fetch)(url, {
				method: request.method,
				headers,
				body: hasBody ? request.body : null,
				// Needed to send a stream; not part of `RequestInit` in every lib.
				...(hasBody ? { duplex: 'half' } : {}),
				redirect: 'manual',
				signal: controller.signal
			} as RequestInit);
		} catch (error) {
			throw unreachable(error, timeout);
		} finally {
			clearTimeout(timer);
		}

		if (response.headers.has(ERROR_HEADER)) {
			const body = (await response.json().catch(() => null)) as { error?: unknown } | null;

			throw new PluginCallError(
				typeof body?.error === 'string' ? body.error : 'The plugin route failed'
			);
		}

		// `fetch` has decoded the body already; the response must not claim it is still encoded.
		if (!response.headers.has('content-encoding')) {
			return response;
		}

		const responseHeaders = new Headers(response.headers);

		responseHeaders.delete('content-encoding');
		responseHeaders.delete('content-length');

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders
		});
	}
}

/** The error for a request that didn't get an answer from the Worker. */
function unreachable(error: unknown, timeout: number) {
	return new PluginCallError(
		error instanceof Error && error.name === 'TimeoutError'
			? `No answer within ${timeout / 1000} seconds`
			: `The plugin's Worker can't be reached: ${error instanceof Error ? error.message : String(error)}`,
		{ cause: error, retryable: true }
	);
}
