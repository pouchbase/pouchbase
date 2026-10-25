import type { PluginManifest } from '@pouchbasejs/plugin-sdk';
import type {
	PluginCall,
	PluginCallContext,
	PluginRouteContext,
	PluginRouteInfo,
	PluginRuntime
} from './runtime';

import jsSdkCode from 'virtual:pouchbase/js-sdk-module';

import { CALL_TIMEOUT, EMPTY_CALL_CONTEXT, PluginCallError, routeRequestHeaders } from './runtime';

/**
 * The Worker of an installed plugin with server code: one per plugin, on the Cloudflare account,
 * deployed with the Script Upload API like the functions (`<instance>-plugin-<id>`). It has four
 * modules:
 *
 * - `ENTRY_MODULE`, the main module: answers `POST /__call` and `/__route/<path>` (any method,
 *   with `CONTEXT_HEADER`) with the plugin secret in `SECRET_HEADER` (compared in constant time)
 *   and 404 to everything else;
 * - `GUARD_MODULE`, imported first so it runs before any plugin code: replaces `globalThis.fetch`
 *   (and `WebSocket`) with versions limited to `permissions.network`;
 * - `SDK_MODULE`: the JS SDK of this Pouchbase (`vite/js-sdk-module.ts`), for `ctx.pouch`;
 * - `PLUGIN_MODULE`: the plugin's bundled `server.js`.
 *
 * The Worker's bindings are the secret (`POUCHBASE_PLUGIN_SECRET`), the URL of Pouchbase
 * (`POUCHBASE_URL`) and the plugin's API key (`POUCHBASE_API_KEY`, scope `plugin`). The plugin
 * gets no `env`: the entry code builds `ctx.pouch` from the URL and the key, with a `fetch` that
 * only reaches that origin, and the records API decides what the key may do. A call is
 * `{ call, context }` as JSON; the answer is `{ ok: true, value }` or `{ ok: false, error }`.
 * Bytes (`Uint8Array`, e.g. a BLOB field value) travel as `{ [BYTES_KEY]: <base64> }` both ways.
 *
 * A route request is the original request, forwarded with its method, headers and streamed body
 * to `/__route<path><search>`; `CONTEXT_HEADER` holds `{ settings, admin, user, url }` as JSON
 * (ASCII only). The Worker rebuilds the request with the original `url`, without the cookie and
 * the `x-pouchbase-plugin-*` headers, and returns the handler's response as is; 404/405 when no
 * route matches. When the handler fails, it answers 500 `{ ok: false, error }` with
 * `ERROR_HEADER`.
 *
 * The allowlist covers `fetch` and `WebSocket`, the APIs plugin code is meant to use. It is not a
 * full sandbox (e.g. `cloudflare:sockets` is not covered): what keeps a plugin away from Pouchbase's
 * data is that its Worker has no bindings to the database, the storage or the secrets, its API key
 * only reaches the collections it may use, and Pouchbase only sends it the call's own data.
 */

export const ENTRY_MODULE = 'pouchbase.js';
export const GUARD_MODULE = 'pouchbase-guard.js';
export const SDK_MODULE = 'pouchbase-sdk.js';
export const PLUGIN_MODULE = 'plugin.js';

/** Request header with the plugin's secret, from Pouchbase to the Worker. */
export const SECRET_HEADER = 'x-pouchbase-plugin-secret';

/** Path of the calls (`PluginCall`). */
export const CALL_PATH = '/__call';

/** Prefix of the route requests: `/__route/items/42` runs the route of `/items/42`. */
export const ROUTE_PATH = '/__route';

/** Request header of a route request with its context as JSON; see `routeContextHeader`. */
export const CONTEXT_HEADER = 'x-pouchbase-plugin-context';

/** Response header that marks a route handler that failed, instead of a response of its own. */
export const ERROR_HEADER = 'x-pouchbase-plugin-error';

/** Key of the object that stands for a `Uint8Array` in the JSON of a call. */
export const BYTES_KEY = '__pouchbase_bytes__';

function toBase64(bytes: Uint8Array) {
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

/** `JSON.stringify` with bytes as `{ [BYTES_KEY]: <base64> }`; mirrored in the entry code. */
export function encodeCallJson(value: unknown) {
	return JSON.stringify(value, (_key, item: unknown) =>
		item instanceof Uint8Array ? { [BYTES_KEY]: toBase64(item) } : item
	);
}

/** `JSON.parse` that turns `{ [BYTES_KEY]: <base64> }` back into bytes; mirrored in the entry code. */
export function decodeCallJson(text: string): unknown {
	return JSON.parse(text, (_key, item: unknown) => {
		if (
			typeof item === 'object' &&
			item !== null &&
			Object.keys(item).length === 1 &&
			typeof (item as Record<string, unknown>)[BYTES_KEY] === 'string'
		) {
			return Uint8Array.from(atob((item as Record<string, string>)[BYTES_KEY]!), (char) =>
				char.charCodeAt(0)
			);
		}

		return item;
	});
}

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

/** `GUARD_MODULE`; the rules match `network.ts`. */
export function guardCode(network: readonly string[]) {
	return `const NETWORK = Object.freeze(${JSON.stringify(network)});
const upstreamFetch = globalThis.fetch;
const UpstreamWebSocket = globalThis.WebSocket;
// Locked on Workers; elsewhere (tests) the globals can be restored.
const locked = globalThis.navigator?.userAgent === 'Cloudflare-Workers';

function hostMatches(hostname, pattern) {
	const host = hostname.toLowerCase().replace(/\\.$/, '');
	const entry = pattern.toLowerCase();

	if (entry.startsWith('*.')) {
		const suffix = entry.slice(1);

		return host.length > suffix.length && host.endsWith(suffix);
	}

	return host === entry;
}

function blockedReason(url, protocol) {
	if (url.protocol !== protocol) {
		return 'Only ' + protocol.slice(0, -1) + ' URLs can be fetched: ' + url.href;
	}

	if (!NETWORK.some((pattern) => hostMatches(url.hostname, pattern))) {
		return url.hostname + ' is not in permissions.network';
	}

	return null;
}

export function restrictedFetch(input, init) {
	try {
		const request = new Request(input, init);
		const reason = blockedReason(new URL(request.url), 'https:');

		if (reason) {
			return Promise.reject(new TypeError(reason));
		}

		return upstreamFetch(new Request(request, { redirect: 'manual' }));
	} catch (error) {
		return Promise.reject(error);
	}
}

// The fetch of ctx.pouch: only the origin of Pouchbase, which permissions.network doesn't cover.
export function originFetch(origin) {
	return (input, init) => {
		try {
			const request = new Request(input, init);

			if (new URL(request.url).origin !== origin) {
				return Promise.reject(new TypeError('ctx.pouch only reaches ' + origin));
			}

			return upstreamFetch(new Request(request, { redirect: 'manual' }));
		} catch (error) {
			return Promise.reject(error);
		}
	};
}

function replace(name, value) {
	Object.defineProperty(globalThis, name, {
		value,
		writable: !locked,
		configurable: !locked,
		enumerable: false
	});
}

replace('fetch', restrictedFetch);

if (typeof UpstreamWebSocket === 'function') {
	replace(
		'WebSocket',
		class WebSocket extends UpstreamWebSocket {
			constructor(url, protocols) {
				const reason = blockedReason(new URL(url), 'wss:');

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
`;
}

/**
 * `ENTRY_MODULE`; `dispatch` and `dispatchRoute` match `runtime.ts`, `matchRoute` matches
 * `routes.ts`, and the JSON helpers match `encodeCallJson`/`decodeCallJson`.
 */
export function entryCode(
	manifest: Pick<PluginManifest, 'id' | 'version'> & Partial<Pick<PluginManifest, 'settings'>>
) {
	const settings = (manifest.settings ?? []).map(({ key, type, default: fallback }) => ({
		key,
		type,
		...(fallback === undefined ? {} : { default: fallback })
	}));

	return `import { originFetch, restrictedFetch } from './${GUARD_MODULE}';
import { Pouchbase } from './${SDK_MODULE}';
import definition from './${PLUGIN_MODULE}';

const PLUGIN = Object.freeze(${JSON.stringify({ id: manifest.id, version: manifest.version })});
const SETTINGS = ${JSON.stringify(settings)};
const BYTES_KEY = '${BYTES_KEY}';
const ROUTE_KEY = /^(GET|POST|PUT|PATCH|DELETE) (\\/\\S*)$/;
const encoder = new TextEncoder();

function matches(value, secret) {
	const left = encoder.encode(value ?? '');
	const right = encoder.encode(secret ?? '');

	return left.byteLength > 0 && left.byteLength === right.byteLength && crypto.subtle.timingSafeEqual(left, right);
}

function toBase64(bytes) {
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

function encodeJson(value) {
	return JSON.stringify(value, (_key, item) => (item instanceof Uint8Array ? { [BYTES_KEY]: toBase64(item) } : item));
}

function decodeJson(text) {
	return JSON.parse(text, (_key, item) =>
		item && typeof item === 'object' && Object.keys(item).length === 1 && typeof item[BYTES_KEY] === 'string'
			? Uint8Array.from(atob(item[BYTES_KEY]), (char) => char.charCodeAt(0))
			: item
	);
}

function json(body, status = 200, headers = {}) {
	return new Response(encodeJson(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function log(level) {
	return (message, data) => console[level]('[plugin ' + PLUGIN.id + ']', message, ...(data === undefined ? [] : [data]));
}

// parseSettingValue and createPluginSettings of @pouchbasejs/plugin-sdk/server.
function parseSettingValue(setting, raw) {
	if (raw === null || raw === undefined) {
		return setting.default ?? null;
	}

	switch (setting.type) {
		case 'number': {
			const number = raw.trim() ? Number(raw) : Number.NaN;

			return Number.isFinite(number) ? number : (setting.default ?? null);
		}
		case 'boolean':
			return raw === 'true';
		default:
			return raw;
	}
}

function settingValues(values) {
	return Object.fromEntries(
		SETTINGS.map((setting) => [
			setting.key,
			parseSettingValue(setting, Object.hasOwn(values, setting.key) && typeof values[setting.key] === 'string' ? values[setting.key] : undefined)
		])
	);
}

let client = null;

// ctx.pouch: the JS SDK with the plugin's key; one per isolate. Without the bindings (a Worker
// deployed before plugins had them), every request fails until the plugin is updated.
function pouch(env) {
	if (!client) {
		let origin = null;

		try {
			origin = new URL(env?.POUCHBASE_URL ?? '').origin;
		} catch {}

		client =
			origin && env?.POUCHBASE_API_KEY
				? new Pouchbase(origin, {
						fetch: originFetch(origin),
						headers: { authorization: 'Bearer ' + env.POUCHBASE_API_KEY }
					})
				: new Pouchbase('https://pouchbase.invalid', {
						fetch: () => Promise.reject(new Error('ctx.pouch is not set up: update the plugin in Pouchbase'))
					});
	}

	return client;
}

function context(input, route = {}, env = {}) {
	const values = input && typeof input.settings === 'object' && input.settings ? input.settings : {};

	return {
		plugin: { ...PLUGIN },
		fetch: restrictedFetch,
		settings: {
			get: async (key) => {
				const all = settingValues(values);

				return Object.hasOwn(all, key) ? all[key] : null;
			},
			getAll: async () => settingValues(values)
		},
		log: { info: log('info'), warn: log('warn'), error: log('error') },
		admin: route.admin === true,
		user: route.user && typeof route.user === 'object' ? route.user : null,
		pouch: pouch(env)
	};
}

function fieldHandler(plugin, type) {
	const fields = plugin.fields ?? {};
	const handler = Object.hasOwn(fields, type) ? fields[type] : undefined;

	return typeof handler === 'object' && handler !== null ? handler : {};
}

async function dispatch(call, ctx) {
	const plugin = definition ?? {};
	const providers = plugin.authProviders ?? {};
	const fields = plugin.fields ?? {};

	switch (call?.type) {
		case 'describe':
			return {
				authProviders: Object.fromEntries(
					Object.entries(providers).map(([id, handler]) => [
						id,
						{ authorizeUrl: handler.authorizeUrl, tokenUrl: handler.tokenUrl, scopes: handler.scopes, pkce: handler.pkce }
					])
				),
				fields: Object.keys(fields),
				routes: Object.keys(plugin.routes ?? {}),
				fieldHandlers: Object.fromEntries(
					Object.keys(fields).map((type) => {
						const handler = fieldHandler(plugin, type);

						return [
							type,
							{
								validate: typeof handler.validate === 'function',
								serialize: typeof handler.serialize === 'function',
								deserialize: typeof handler.deserialize === 'function'
							}
						];
					})
				)
			};
		case 'profile': {
			const handler = Object.hasOwn(providers, call.provider) ? providers[call.provider] : undefined;

			if (typeof handler?.profile !== 'function') {
				throw new Error('The plugin has no auth provider ' + call.provider);
			}

			return handler.profile(String(call.accessToken ?? ''), { clientId: String(call.credentials?.clientId ?? '') }, ctx);
		}
		case 'fields.write': {
			const results = [];

			for (const item of Array.isArray(call.items) ? call.items : []) {
				const handler = fieldHandler(plugin, item?.type);

				if (typeof handler.validate === 'function') {
					const validation = await handler.validate(item.value, item.options ?? {}, ctx);

					if (validation?.valid === false) {
						results.push({
							ok: false,
							message: typeof validation.message === 'string' && validation.message ? validation.message : 'The value is not valid'
						});
						continue;
					}
				}

				const value = typeof handler.serialize === 'function' ? await handler.serialize(item.value, ctx) : item.value;

				results.push({ ok: true, value: value ?? null });
			}

			return results;
		}
		case 'fields.read':
			return Promise.all(
				(Array.isArray(call.items) ? call.items : []).map((item) => {
					const handler = fieldHandler(plugin, item?.type);

					return Promise.all(
						(Array.isArray(item?.values) ? item.values : []).map(async (value) =>
							typeof handler.deserialize === 'function' ? ((await handler.deserialize(value, ctx)) ?? null) : value
						)
					);
				})
			);
		default:
			throw new Error('Unknown call: ' + call?.type);
	}
}

function splitPath(path) {
	const parts = path.split('/').slice(1);

	if (parts.length && parts[parts.length - 1] === '') {
		parts.pop();
	}

	return parts;
}

function matchSegments(pattern, parts) {
	if (pattern.length !== parts.length) {
		return null;
	}

	const params = {};

	for (let index = 0; index < pattern.length; index++) {
		const segment = pattern[index];
		const part = parts[index];

		if (segment.startsWith(':') && segment.length > 1) {
			if (part === '') {
				return null;
			}

			try {
				params[segment.slice(1)] = decodeURIComponent(part);
			} catch {
				return null;
			}
		} else if (segment !== part) {
			return null;
		}
	}

	return params;
}

function compareSpecificity(a, b) {
	for (let index = 0; index < a.length; index++) {
		const left = a[index].startsWith(':');
		const right = b[index].startsWith(':');

		if (left !== right) {
			return left ? 1 : -1;
		}
	}

	return 0;
}

function matchRoute(routes, method, pathname) {
	const parts = splitPath(pathname);
	let best = null;
	const allow = new Set();

	for (const [key, handler] of Object.entries(routes)) {
		const parsed = ROUTE_KEY.exec(key);

		if (!parsed || typeof handler !== 'function') {
			continue;
		}

		const pattern = splitPath(parsed[2]);
		const params = matchSegments(pattern, parts);

		if (!params) {
			continue;
		}

		allow.add(parsed[1]);

		if (parsed[1] !== method.toUpperCase()) {
			continue;
		}

		if (!best || compareSpecificity(pattern, best.pattern) < 0) {
			best = { pattern, handler, params };
		}
	}

	if (best) {
		return { handler: best.handler, params: best.params };
	}

	return allow.size ? { status: 405, allow: [...allow].sort() } : { status: 404 };
}

function routeNotFound(match) {
	return match.status === 405
		? Response.json({ message: 'Method not allowed' }, { status: 405, headers: { allow: match.allow.join(', ') } })
		: Response.json({ message: 'Route not found' }, { status: 404 });
}

function isHiddenRequestHeader(name) {
	const lower = name.toLowerCase();

	return lower === 'cookie' || lower === 'host' || lower.startsWith('x-pouchbase-plugin-');
}

async function route(request, env) {
	let input;

	try {
		input = JSON.parse(request.headers.get('${CONTEXT_HEADER}') ?? '');
	} catch {
		return json({ ok: false, error: 'The route context is not valid JSON' }, 400);
	}

	const forwarded = new URL(request.url);
	const path = forwarded.pathname.slice('${ROUTE_PATH}'.length) || '/';
	const headers = new Headers();

	for (const [name, value] of request.headers) {
		if (!isHiddenRequestHeader(name)) {
			headers.append(name, value);
		}
	}

	let url = forwarded.href;

	try {
		url = new URL(String(input?.url ?? '')).href;
	} catch {}

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	const original = new Request(url, {
		method: request.method,
		headers,
		body: hasBody ? request.body : null,
		duplex: hasBody ? 'half' : undefined,
		redirect: 'manual'
	});
	const match = matchRoute((definition ?? {}).routes ?? {}, original.method, path);

	if ('status' in match) {
		return routeNotFound(match);
	}

	try {
		const response = await match.handler(original, { ...context(input, input ?? {}, env), params: match.params });

		if (!(response instanceof Response)) {
			throw new Error('The route handler did not return a Response');
		}

		return response;
	} catch (error) {
		log('error')('Route ' + original.method + ' ' + path + ' failed', error instanceof Error ? error.message : String(error));

		return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500, { '${ERROR_HEADER}': '1' });
	}
}

export default {
	async fetch(request, env) {
		if (!matches(request.headers.get('${SECRET_HEADER}'), env.POUCHBASE_PLUGIN_SECRET)) {
			return new Response('Not found', { status: 404 });
		}

		const { pathname } = new URL(request.url);

		if (request.headers.has('${CONTEXT_HEADER}')) {
			if (pathname !== '${ROUTE_PATH}' && !pathname.startsWith('${ROUTE_PATH}/')) {
				return new Response('Not found', { status: 404 });
			}

			return route(request, env);
		}

		if (request.method !== 'POST' || pathname !== '${CALL_PATH}') {
			return new Response('Not found', { status: 404 });
		}

		let body;

		try {
			body = decodeJson(await request.text());
		} catch {
			return json({ ok: false, error: 'The call is not valid JSON' }, 400);
		}

		try {
			const value = await dispatch(body?.call, context(body?.context, {}, env));

			return json({ ok: true, value: value ?? null });
		} catch (error) {
			return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
		}
	}
};
`;
}

/** The modules of a plugin's Worker, for `functions.deploy`. */
export function workerModules(
	manifest: Pick<PluginManifest, 'id' | 'version'> & {
		permissions: Pick<PluginManifest['permissions'], 'network'>;
	} & Partial<Pick<PluginManifest, 'settings'>>,
	server: string
) {
	return [
		{ name: ENTRY_MODULE, content: entryCode(manifest) },
		{ name: GUARD_MODULE, content: guardCode(manifest.permissions.network) },
		{ name: SDK_MODULE, content: jsSdkCode },
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
