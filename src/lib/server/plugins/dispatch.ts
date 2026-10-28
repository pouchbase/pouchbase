import type { PluginManifest } from '@pouchbasejs/plugin-sdk';
import type {
	FieldTypeHandler,
	FieldValue,
	PluginContext,
	PluginUser,
	ServerDefinition
} from '@pouchbasejs/plugin-sdk/server';
import type { FieldWriteResult, PluginCall, PluginCallContext } from './protocol';

import { Pouchbase } from '@pouchbasejs/js-sdk';
import { createPluginSettings } from '@pouchbasejs/plugin-sdk/server';

import { matchRoute } from './routes';

/**
 * Running a call or a route request against a plugin's server code (its `ServerDefinition`).
 * Shared by the in-process runtime (`in-process.ts`) and the Worker of an installed plugin: its
 * entry module (`worker/pouchbase.ts`) is bundled from this file, so there is one implementation.
 * Nothing here may import from `$app` or the rest of the server: it has to run in a Worker.
 */

/** A call that failed in the plugin, or never reached it. */
export class PluginCallError extends Error {
	override name = 'PluginCallError';
	/** The call never reached the plugin (e.g. its Worker isn't reachable yet); trying again may help. */
	readonly retryable: boolean;

	constructor(message: string, options: { cause?: unknown; retryable?: boolean } = {}) {
		super(message, { cause: options.cause });
		this.retryable = options.retryable ?? false;
	}
}

/**
 * Request headers that never reach a plugin's route: the admin's session cookie, and the host's
 * own `x-pouchbase-plugin-*` headers (so a client can't send them).
 */
export function isHiddenRequestHeader(name: string) {
	const lower = name.toLowerCase();

	return lower === 'cookie' || lower === 'host' || lower.startsWith('x-pouchbase-plugin-');
}

/** The headers of `request` that a plugin's route may see. */
export function routeRequestHeaders(headers: Headers): Headers {
	const result = new Headers();

	for (const [name, value] of headers) {
		if (!isHiddenRequestHeader(name)) {
			result.append(name, value);
		}
	}

	return result;
}

/**
 * A `ctx.pouch` whose every request fails, where the host has none to give (e.g. while it asks a
 * built-in plugin to `describe` itself).
 */
export function unavailablePouch(): Pouchbase {
	return new Pouchbase('https://pouchbase.invalid', {
		fetch: () => Promise.reject(new Error('ctx.pouch is not available here'))
	});
}

/**
 * The `PluginContext` the plugin's handlers get; `admin` and `user` only for a route request.
 * `ctx.settings.get(key)` parses the value by the setting's type in `manifest.settings`
 * (`createPluginSettings`).
 */
export function pluginContext(
	manifest: Pick<PluginManifest, 'id' | 'version'> & Partial<Pick<PluginManifest, 'settings'>>,
	context: PluginCallContext,
	fetch: typeof globalThis.fetch,
	{
		admin = false,
		user = null,
		pouch = unavailablePouch()
	}: { admin?: boolean; user?: PluginUser | null; pouch?: Pouchbase } = {}
): PluginContext {
	const prefix = `[plugin ${manifest.id}]`;

	return {
		plugin: { id: manifest.id, version: manifest.version },
		fetch,
		settings: createPluginSettings(manifest.settings, context.settings),
		log: {
			info: (message, data) => console.info(prefix, message, ...(data === undefined ? [] : [data])),
			warn: (message, data) => console.warn(prefix, message, ...(data === undefined ? [] : [data])),
			error: (message, data) =>
				console.error(prefix, message, ...(data === undefined ? [] : [data]))
		},
		admin,
		user,
		pouch
	};
}

/** The handler of a field type; one the plugin doesn't define has no hooks. */
function fieldHandler(plugin: ServerDefinition, type: string): FieldTypeHandler {
	const fields = plugin.fields ?? {};
	const handler = Object.hasOwn(fields, type) ? fields[type] : undefined;

	return typeof handler === 'object' && handler !== null ? handler : {};
}

/** Runs a call against the plugin's server code. */
export async function dispatch(
	definition: ServerDefinition | undefined,
	call: PluginCall,
	ctx: PluginContext
): Promise<unknown> {
	const plugin = definition ?? {};

	switch (call.type) {
		case 'describe': {
			const providers = plugin.authProviders ?? {};
			const fields = plugin.fields ?? {};

			return {
				authProviders: Object.fromEntries(
					Object.entries(providers).map(([id, handler]) => [
						id,
						{
							authorizeUrl: handler.authorizeUrl,
							tokenUrl: handler.tokenUrl,
							scopes: handler.scopes,
							pkce: handler.pkce
						}
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
		}
		case 'profile': {
			const providers = plugin.authProviders ?? {};
			const handler = Object.hasOwn(providers, call.provider)
				? providers[call.provider]
				: undefined;

			if (typeof handler?.profile !== 'function') {
				throw new PluginCallError(`The plugin has no auth provider ${call.provider}`);
			}

			return handler.profile(call.accessToken, { clientId: call.credentials.clientId }, ctx);
		}
		case 'fields.write': {
			const results: FieldWriteResult[] = [];

			for (const item of call.items) {
				const handler = fieldHandler(plugin, item.type);

				if (typeof handler.validate === 'function') {
					const validation = await handler.validate(item.value, item.options ?? {}, ctx);

					if (validation?.valid === false) {
						results.push({
							ok: false,
							message:
								typeof validation.message === 'string' && validation.message
									? validation.message
									: 'The value is not valid'
						});
						continue;
					}
				}

				const value =
					typeof handler.serialize === 'function'
						? await handler.serialize(item.value, ctx)
						: (item.value as FieldValue);

				results.push({ ok: true, value: value ?? null });
			}

			return results;
		}
		case 'fields.read': {
			return Promise.all(
				call.items.map((item) => {
					const handler = fieldHandler(plugin, item.type);

					return Promise.all(
						item.values.map(async (value) =>
							typeof handler.deserialize === 'function'
								? ((await handler.deserialize(value, ctx)) ?? null)
								: value
						)
					);
				})
			);
		}
		default:
			throw new PluginCallError(`Unknown call: ${(call as { type: unknown }).type}`);
	}
}

/** The answer when no route matches: 404, or 405 with `Allow` when only the method doesn't. */
export function routeNotFound(match: { status: 404 } | { status: 405; allow: string[] }) {
	return match.status === 405
		? Response.json(
				{ message: 'Method not allowed' },
				{ status: 405, headers: { allow: match.allow.join(', ') } }
			)
		: Response.json({ message: 'Route not found' }, { status: 404 });
}

/**
 * Runs the route of `definition` that matches `request` and `path` (see `matchRoute`). Throws
 * `PluginCallError` when the handler throws or doesn't return a `Response`.
 */
export async function dispatchRoute(
	definition: ServerDefinition | undefined,
	request: Request,
	path: string,
	ctx: PluginContext
): Promise<Response> {
	const match = matchRoute(definition?.routes ?? {}, request.method, path);

	if ('status' in match) {
		return routeNotFound(match);
	}

	let response: unknown;

	try {
		response = await match.handler(request, { ...ctx, params: match.params });
	} catch (error) {
		throw new PluginCallError(error instanceof Error ? error.message : String(error), {
			cause: error
		});
	}

	if (!(response instanceof Response)) {
		throw new PluginCallError('The route handler did not return a Response');
	}

	return response;
}
