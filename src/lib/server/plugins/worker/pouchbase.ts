import type { PluginContext, PluginUser } from '@pouchbasejs/plugin-sdk/server';
import type { PluginCall } from '../protocol';

import { Pouchbase } from '@pouchbasejs/js-sdk';

import {
	dispatch,
	dispatchFunction,
	dispatchRoute,
	pluginContext,
	routeRequestHeaders
} from '../dispatch';
import {
	CALL_PATH,
	CONTEXT_HEADER,
	decodeCallJson,
	encodeCallJson,
	ERROR_HEADER,
	FUNCTION_PATH,
	ROUTE_PATH,
	SECRET_HEADER
} from './codec';
import { originFetch, pluginFetch } from './pouchbase-guard.js';
import config from './pouchbase-config.js';
import definition from './plugin.js';

/**
 * `pouchbase.js`, the entry of a plugin's Worker (see `worker.ts` for the whole picture): answers
 * `POST /__call`, `/__route/<path>` and `/__function/<name>` (any method, with `CONTEXT_HEADER`)
 * with the plugin secret in `SECRET_HEADER` (compared in constant time), and 404 to everything
 * else. They run through the same `dispatch.ts` as a plugin that runs inside Pouchbase. Bundled by
 * `vite/plugin-worker.ts`; the guard is imported first so it runs before `plugin.js`.
 */

/** The Worker's bindings. */
type Env = {
	POUCHBASE_PLUGIN_SECRET?: string;
	POUCHBASE_URL?: string;
	POUCHBASE_API_KEY?: string;
};

/** `CONTEXT_HEADER` as the host sends it; see `routeContextHeader`. */
type RouteInput = {
	settings?: unknown;
	admin?: unknown;
	user?: unknown;
	url?: unknown;
};

const encoder = new TextEncoder();

function matches(value: string | null, secret: string | undefined) {
	const left = encoder.encode(value ?? '');
	const right = encoder.encode(secret ?? '');

	return (
		left.byteLength > 0 &&
		left.byteLength === right.byteLength &&
		(
			crypto.subtle as unknown as { timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean }
		).timingSafeEqual(left, right)
	);
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(encodeCallJson(body), {
		status,
		headers: { 'content-type': 'application/json', ...headers }
	});
}

function message(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

let client: Pouchbase | null = null;

/** `ctx.pouch`: the JS SDK with the plugin's key; one per isolate. */
function pouch(env: Env) {
	if (!client) {
		const origin = new URL(env.POUCHBASE_URL ?? '').origin;

		client = new Pouchbase(origin, {
			fetch: originFetch(origin),
			headers: { authorization: `Bearer ${env.POUCHBASE_API_KEY ?? ''}` }
		});
	}

	return client;
}

/** The plugin's context for a call or a route: the settings the host sent, as strings. */
function context(input: unknown, env: Env, route: { admin?: unknown; user?: unknown } = {}) {
	const sent = (input as { settings?: unknown } | null)?.settings;
	const settings =
		typeof sent === 'object' && sent !== null ? (sent as Record<string, string>) : {};

	return pluginContext(config.plugin, { settings }, pluginFetch, {
		admin: route.admin === true,
		user: route.user && typeof route.user === 'object' ? (route.user as PluginUser) : null,
		pouch: pouch(env)
	});
}

/**
 * A route or function request: rebuilt with its original URL, without the host's own headers, and
 * answered by `run`. `label` names it in the log.
 */
async function forwarded(
	request: Request,
	env: Env,
	label: string,
	run: (original: Request, ctx: PluginContext) => Promise<Response>
) {
	let input: RouteInput;

	try {
		input = JSON.parse(request.headers.get(CONTEXT_HEADER) ?? '') as RouteInput;
	} catch {
		return json({ ok: false, error: 'The route context is not valid JSON' }, 400);
	}

	let url = request.url;

	try {
		url = new URL(String(input?.url ?? '')).href;
	} catch {
		// Not a URL: the forwarded one will do.
	}

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	const original = new Request(url, {
		method: request.method,
		headers: routeRequestHeaders(request.headers),
		body: hasBody ? request.body : null,
		// Needed to send a stream; not part of `RequestInit` in every lib.
		...(hasBody ? { duplex: 'half' } : {}),
		redirect: 'manual'
	} as RequestInit);

	try {
		return await run(original, context(input, env, input ?? {}));
	} catch (error) {
		console.error(
			`[plugin ${config.plugin.id}] ${label} ${original.method} failed`,
			message(error)
		);

		return json({ ok: false, error: message(error) }, 500, { [ERROR_HEADER]: '1' });
	}
}

export default {
	async fetch(request: Request, env: Env) {
		if (!matches(request.headers.get(SECRET_HEADER), env.POUCHBASE_PLUGIN_SECRET)) {
			return new Response('Not found', { status: 404 });
		}

		const { pathname } = new URL(request.url);

		if (request.headers.has(CONTEXT_HEADER)) {
			if (pathname === ROUTE_PATH || pathname.startsWith(`${ROUTE_PATH}/`)) {
				const path = pathname.slice(ROUTE_PATH.length) || '/';

				return forwarded(request, env, `Route ${path}`, (original, ctx) =>
					dispatchRoute(definition, original, path, ctx)
				);
			}

			if (pathname.startsWith(`${FUNCTION_PATH}/`)) {
				const name = pathname.slice(FUNCTION_PATH.length + 1);

				return forwarded(request, env, `Function ${name}`, (original, ctx) =>
					dispatchFunction(definition, original, name, ctx)
				);
			}

			return new Response('Not found', { status: 404 });
		}

		if (request.method !== 'POST' || pathname !== CALL_PATH) {
			return new Response('Not found', { status: 404 });
		}

		let body: { call?: PluginCall; context?: unknown } | null;

		try {
			body = decodeCallJson(await request.text()) as typeof body;
		} catch {
			return json({ ok: false, error: 'The call is not valid JSON' }, 400);
		}

		try {
			const value = await dispatch(
				definition,
				body?.call as PluginCall,
				context(body?.context, env)
			);

			return json({ ok: true, value: value ?? null });
		} catch (error) {
			return json({ ok: false, error: message(error) }, 500);
		}
	}
};
