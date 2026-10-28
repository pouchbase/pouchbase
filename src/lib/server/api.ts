import type { ApiKey } from './services/api-keys.service';
import type { ApiAccess } from './services/records.service';
import type { RequestEvent } from '@sveltejs/kit';

import { internalPluginKey, INTERNAL_PLUGIN_KEY_PREFIX } from './plugins/internal-keys';
import { API_KEY_PREFIX } from './services/api-keys.service';

/**
 * Helpers for the public API (`/api/...`) that client apps call. The API can be
 * called from any origin: it uses bearer tokens, never cookies, so CORS can't leak a session.
 */

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type',
	'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
	'Access-Control-Max-Age': '600'
};

/** JSON response with CORS headers. */
export function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
	});
}

/** Plain text response with CORS headers, e.g. generated code. */
export function text(body: string, contentType = 'text/plain; charset=utf-8') {
	return new Response(body, { headers: { ...CORS_HEADERS, 'Content-Type': contentType } });
}

/** An empty `204 No Content` response with CORS headers, e.g. after a delete. */
export function noContent() {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Answers a CORS preflight request. */
export function preflight() {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** The token from an `Authorization: Bearer <token>` header. */
export function bearerToken(event: RequestEvent) {
	const header = event.request.headers.get('authorization') ?? '';
	const [scheme, token] = header.split(' ');

	return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * The user of the request's bearer token, or `null` without one. An invalid or expired token gets
 * a `401` response instead, so the client notices it was signed out instead of seeing less data.
 */
export async function requestUser(
	event: RequestEvent
): Promise<{ user: Record<string, unknown> | null } | { response: Response }> {
	const token = bearerToken(event);

	if (!token) {
		return { user: null };
	}

	const result = await event.locals.services.auth().verifyToken(token);

	if (result.isErr()) {
		if (result.error.code === 11006 || result.error.code === 11007) {
			return { response: json({ message: 'Invalid or expired token' }, 401) };
		}

		return { response: json({ message: 'Could not check the token' }, 500) };
	}

	return { user: result.value };
}

/** The key of the request's bearer token, the key of a plugin too; see `requestApiKey`. */
async function verifiedApiKey(
	event: RequestEvent
): Promise<{ key: ApiKey } | { response: Response }> {
	const token = bearerToken(event);

	if (!token) {
		return { response: json({ message: 'Send an API key as `Authorization: Bearer pbk_…`' }, 401) };
	}

	const result = await event.locals.services.apiKeys().verify(token);

	if (result.isErr()) {
		return { response: json({ message: 'Could not check the API key' }, 500) };
	}

	if (!result.value) {
		return { response: json({ message: 'Invalid API key' }, 401) };
	}

	return { key: result.value };
}

/**
 * The API key of the request's bearer token (`pbk_…`, see `ApiKeysService`), for routes only
 * server-side code may call; a key acts as an admin. Without a valid key the route answers with
 * the `401` response; the key of a plugin gets a `403`, as it only reaches the records API.
 */
export async function requestApiKey(
	event: RequestEvent
): Promise<{ key: ApiKey } | { response: Response }> {
	const caller = await verifiedApiKey(event);

	if ('response' in caller) {
		return caller;
	}

	if (caller.key.pluginId) {
		return { response: json({ message: 'A plugin key can only use the records API' }, 403) };
	}

	return caller;
}

/**
 * What the plugin `pluginId` may do through the records API (see `PluginsService.grant`); a `401`
 * response when the plugin is gone.
 */
async function pluginAccess(
	event: RequestEvent,
	pluginId: string
): Promise<{ access: ApiAccess } | { response: Response }> {
	const result = await event.locals.services.plugins().grant(pluginId);

	if (result.isErr()) {
		return { response: json({ message: "Could not check the plugin's permissions" }, 500) };
	}

	if (!result.value) {
		return { response: json({ message: 'The plugin of this key is not installed' }, 401) };
	}

	return { access: { plugin: result.value } };
}

/**
 * Who the records API acts for: the user of the request's bearer token (`{ user }`, see
 * `requestUser`), a plugin (`{ plugin }`, for the key of its Worker, or the in-memory key of a
 * built-in plugin, see `internal-keys.ts`), or `undefined` for any other API key, which acts as an
 * admin: the API rules don't apply to it. An invalid key gets a `401` response.
 */
export async function requestAccess(
	event: RequestEvent
): Promise<{ access: ApiAccess | undefined } | { response: Response }> {
	const token = bearerToken(event);

	if (token?.startsWith(INTERNAL_PLUGIN_KEY_PREFIX)) {
		const pluginId = internalPluginKey(token);

		return pluginId
			? pluginAccess(event, pluginId)
			: { response: json({ message: 'Invalid API key' }, 401) };
	}

	if (!token?.startsWith(API_KEY_PREFIX)) {
		const caller = await requestUser(event);

		return 'response' in caller ? caller : { access: { user: caller.user } };
	}

	const caller = await verifiedApiKey(event);

	if ('response' in caller) {
		return caller;
	}

	return caller.key.pluginId ? pluginAccess(event, caller.key.pluginId) : { access: undefined };
}
