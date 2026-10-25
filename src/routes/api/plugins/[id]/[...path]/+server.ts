import type { RequestHandler } from './$types';

import { PLUGIN_ID_PATTERN } from '@pouchbasejs/plugin-sdk';

import { bearerToken, json, requestUser } from '#lib/server/api.js';
import {
	isSameOriginRequest,
	deliverRouteResponse,
	ROUTE_CORS_HEADERS
} from '#lib/server/plugins/requests.js';
import { pluginUser } from '#lib/server/plugins/runtime.js';
import { API_KEY_PREFIX } from '#lib/server/services/api-keys.service.js';

/**
 * Runs a plugin's route (`routes` of its `definePlugin(...)`): `/api/plugins/<id>/<path>` goes to
 * the route of `<path>`, with the method, headers (without the cookie) and body of the request,
 * and the plugin's response comes back as it is. `assets/...` and `modules` are Pouchbase's own
 * routes, so a plugin can't answer them.
 *
 * Like the rest of the API any origin may call it. The plugin sees `ctx.admin` when a signed-in
 * admin calls it from the dashboard (session cookie and `Sec-Fetch-Site: same-origin`), and
 * `ctx.user` for the bearer token of an app user; an invalid or expired token answers 401 before
 * the plugin runs, and an API key is no user. Responses are sandboxed: HTML a plugin returns
 * can't run scripts on the admin's origin.
 */

export const OPTIONS: RequestHandler = () =>
	new Response(null, { status: 204, headers: ROUTE_CORS_HEADERS });

export const fallback: RequestHandler = async (event) => {
	const { params, request, url, locals } = event;

	if (!PLUGIN_ID_PATTERN.test(params.id)) {
		return json({ message: 'Plugin not found' }, 404);
	}

	let user = null;

	if (!bearerToken(event)?.startsWith(API_KEY_PREFIX)) {
		const caller = await requestUser(event);

		if ('response' in caller) {
			return caller.response;
		}

		user = caller.user
			? pluginUser(caller.user as Record<string, unknown> & { id: unknown })
			: null;
	}

	// The path as the client sent it, still encoded, so `%2F` in a segment stays one segment.
	const path = url.pathname.slice(`/api/plugins/${params.id}`.length) || '/';
	const result = await locals.services.plugins().route(params.id, request, path, {
		admin: locals.user !== null && isSameOriginRequest(request.headers),
		user
	});

	if (result.isErr()) {
		if (result.error.code === 19013) {
			console.error(
				`[plugins] ${params.id} ${request.method} ${path}: ${result.error.data.reason}`
			);

			return json({ message: 'The plugin route failed' }, 502);
		}

		return json({ message: 'Could not load the plugin' }, 500);
	}

	if (!result.value) {
		return json({ message: 'Plugin not found' }, 404);
	}

	return deliverRouteResponse(result.value);
};
