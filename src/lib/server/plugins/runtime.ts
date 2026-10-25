import type { PluginManifest } from '@pouchbasejs/plugin-sdk';
import type {
	FieldTypeHandler,
	FieldValue,
	OAuthProfile,
	PluginContext,
	PluginDefinition,
	PluginUser
} from '@pouchbasejs/plugin-sdk/server';

import { createPluginSettings } from '@pouchbasejs/plugin-sdk/server';
import { z } from 'zod';

import { matchRoute } from './routes';

/**
 * How the host runs a plugin's server code. Every plugin with server code has a `PluginRuntime`:
 *
 * - an installed plugin runs in its own Worker on the Cloudflare account (`WorkerRuntime`,
 *   `worker.ts`), reached over workers.dev with a shared secret;
 * - a built-in plugin (`plugins/*` in this repository) runs inside Pouchbase
 *   (`InProcessRuntime`, `embedded.ts`).
 *
 * Both answer the same calls, through `dispatch` below, and the same route requests, through
 * `dispatchRoute` (the Worker has a copy of both in its entry code). The host does the OAuth
 * redirect and the token exchange itself, from what `describe` returns; only `profile` runs plugin
 * code during a sign-in.
 */

/**
 * A value of a plugin field to save: `type` is the plugin's own type (`rating`, without the
 * `<plugin>:` prefix), `name` the field's column and `options` the field's settings.
 */
export type FieldWriteItem = {
	type: string;
	name: string;
	options: Record<string, unknown>;
	value: unknown;
};

/** The answer for one `FieldWriteItem`: the value to store, or why it isn't valid. */
export type FieldWriteResult = { ok: true; value: FieldValue } | { ok: false; message: string };

/** Stored values of a plugin field type to turn into what the API returns. */
export type FieldReadItem = { type: string; values: FieldValue[] };

/** A call from the host into a plugin's server code. */
export type PluginCall =
	| { type: 'describe' }
	| {
			type: 'profile';
			/** The provider id, e.g. `google`. */
			provider: string;
			accessToken: string;
			credentials: { clientId: string };
	  }
	| {
			/**
			 * Validates, then serializes each value; answers a `FieldWriteResult[]` in the same order.
			 * Without `validate` a value is valid, without `serialize` it is stored as is.
			 */
			type: 'fields.write';
			items: FieldWriteItem[];
	  }
	| {
			/**
			 * Deserializes each stored value; answers one array of values per item, in the same order.
			 * Without `deserialize` a value is returned as stored.
			 */
			type: 'fields.read';
			items: FieldReadItem[];
	  };

/** What the host passes along with every call. */
export type PluginCallContext = {
	/**
	 * The plugin's settings as strings, resolved with their defaults (see `resolveSettings`);
	 * `ctx.settings.get` parses them by the manifest's `settings` (see `parseSettingValue`).
	 */
	settings: Record<string, string>;
};

/** What the host passes along with a route request, on top of `PluginCallContext`. */
export type PluginRouteContext = PluginCallContext & {
	/** `ctx.admin`: a signed-in admin of the dashboard, on a same-origin request. */
	admin: boolean;
	/** `ctx.user`: the app user of the request's bearer token (see `pluginUser`). */
	user: PluginUser | null;
};

/** Where a route request goes: the path below `/api/plugins/<id>` and the query string. */
export type PluginRouteInfo = {
	/** E.g. `/items/42`; always starts with `/`. */
	path: string;
	/** E.g. `?page=2`, or empty. */
	search: string;
};

export const EMPTY_CALL_CONTEXT: PluginCallContext = { settings: {} };

export interface PluginRuntime {
	/** Runs a call; throws `PluginCallError` when the plugin fails or doesn't answer in time. */
	call(call: PluginCall, context?: PluginCallContext): Promise<unknown>;
	/**
	 * Runs the plugin's route for `request` (whose URL stays the original one) and returns the
	 * handler's `Response`, or a 404/405 JSON response when no route matches. Throws
	 * `PluginCallError` when the handler fails or doesn't answer in time.
	 */
	route(request: Request, info: PluginRouteInfo, context: PluginRouteContext): Promise<Response>;
}

/**
 * `runtime` with `context` as the context of every call that doesn't pass its own, so callers that
 * know nothing of settings (e.g. a sign-in's `profile`) still give the plugin its settings.
 */
export function withCallContext(runtime: PluginRuntime, context: PluginCallContext): PluginRuntime {
	return {
		call: (call, own) => runtime.call(call, own ?? context),
		route: (request, info, routeContext) => runtime.route(request, info, routeContext)
	};
}

/** How long a call may take; for a route, until the response starts. */
export const CALL_TIMEOUT = 10_000;

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

const httpsUrl = z.url({ protocol: /^https$/ });

/** What the host needs to run the OAuth flow of a provider; reported by `describe`. */
export const providerConfigSchema = z.object({
	authorizeUrl: httpsUrl,
	tokenUrl: httpsUrl,
	scopes: z.array(z.string().min(1).max(200)).max(50),
	pkce: z.boolean()
});

export type ProviderConfig = z.output<typeof providerConfigSchema>;

/** Which hooks a field type implements; the host skips the call when it has none it needs. */
export const fieldHandlerSchema = z.object({
	validate: z.boolean(),
	serialize: z.boolean(),
	deserialize: z.boolean()
});

export type FieldHandlerInfo = z.output<typeof fieldHandlerSchema>;

/** The answer to `describe`: what the server code implements. */
export const describeResultSchema = z.object({
	authProviders: z.record(z.string(), providerConfigSchema),
	fields: z.array(z.string()),
	routes: z.array(z.string()),
	/** By field type; missing from plugins described before field hooks ran. */
	fieldHandlers: z.record(z.string(), fieldHandlerSchema).optional()
});

export type DescribeResult = z.output<typeof describeResultSchema>;

/** The answer to `profile`, checked before it signs anyone in. */
export const oauthProfileSchema = z.object({
	id: z.string().min(1).max(256),
	email: z.string().max(320).nullable(),
	emailVerified: z.boolean(),
	name: z.string().max(256).nullable(),
	avatarUrl: z.string().max(2048).nullable()
}) satisfies z.ZodType<OAuthProfile>;

/** Checks a `profile` answer; throws `PluginCallError` when it isn't a valid profile. */
export function parseProfile(value: unknown): OAuthProfile {
	const result = oauthProfileSchema.safeParse(value);

	if (!result.success) {
		const issue = result.error.issues[0];

		throw new PluginCallError(
			`The plugin's profile answer is not valid: ${issue ? `${issue.path.join('.') || 'profile'}: ${issue.message}` : 'unknown'}`
		);
	}

	return result.data;
}

/**
 * The `PluginUser` of a row of the `users` collection: the auth fields, and the other fields with
 * plain values. Passwords live in their own table, so the row has none; binary values and columns
 * starting with `_` are left out.
 */
export function pluginUser(row: Record<string, unknown> & { id: unknown }): PluginUser {
	const { id, email, name, verified, avatar, ...rest } = row;
	const fields: PluginUser['fields'] = {};

	for (const [key, value] of Object.entries(rest)) {
		if (key.startsWith('_')) {
			continue;
		}

		if (
			value === null ||
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			fields[key] = value;
		}
	}

	return {
		id: String(id),
		email: typeof email === 'string' && email ? email : null,
		name: typeof name === 'string' && name ? name : null,
		verified: verified === true || verified === 1 || verified === '1' || verified === 'true',
		avatar: typeof avatar === 'string' && avatar ? avatar : null,
		fields
	};
}

/**
 * The `PluginContext` the plugin's handlers get; `admin` and `user` only for a route request.
 * `ctx.settings.get(key)` parses the value by the setting's type in `manifest.settings`
 * (`createPluginSettings`); mirrored in the Worker's entry code (`worker.ts`).
 */
export function pluginContext(
	manifest: Pick<PluginManifest, 'id' | 'version'> & Partial<Pick<PluginManifest, 'settings'>>,
	context: PluginCallContext,
	fetch: typeof globalThis.fetch,
	{ admin = false, user = null }: { admin?: boolean; user?: PluginUser | null } = {}
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
		user
	};
}

/** The handler of a field type; one the plugin doesn't define has no hooks. */
function fieldHandler(plugin: PluginDefinition, type: string): FieldTypeHandler {
	const fields = plugin.fields ?? {};
	const handler = Object.hasOwn(fields, type) ? fields[type] : undefined;

	return typeof handler === 'object' && handler !== null ? handler : {};
}

/** Runs a call against the plugin's `definePlugin(...)` export. Mirrored in `worker.ts`. */
export async function dispatch(
	definition: PluginDefinition | undefined,
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
 * `PluginCallError` when the handler throws or doesn't return a `Response`. Mirrored in
 * `worker.ts`.
 */
export async function dispatchRoute(
	definition: PluginDefinition | undefined,
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

/** Runs `describe` and checks the answer. */
export async function describePlugin(
	runtime: PluginRuntime,
	context?: PluginCallContext
): Promise<DescribeResult> {
	const result = describeResultSchema.safeParse(await runtime.call({ type: 'describe' }, context));

	if (!result.success) {
		const issue = result.error.issues[0];

		throw new PluginCallError(
			`The plugin's describe answer is not valid: ${issue ? `${issue.path.join('.')}: ${issue.message}` : 'unknown'}`
		);
	}

	return result.data;
}

const fieldValueSchema = z.union([z.string(), z.number(), z.instanceof(Uint8Array), z.null()]);

const fieldWriteResultSchema = z.union([
	z.object({ ok: z.literal(true), value: fieldValueSchema }),
	z.object({ ok: z.literal(false), message: z.string() })
]);

/**
 * Runs `fields.write` and checks the answer: one `FieldWriteResult` per item, and every stored
 * value fits a column (string, number, bytes or `null`).
 */
export async function writeFieldValues(
	runtime: PluginRuntime,
	items: FieldWriteItem[],
	context?: PluginCallContext
): Promise<FieldWriteResult[]> {
	if (!items.length) {
		return [];
	}

	const result = z
		.array(fieldWriteResultSchema)
		.length(items.length)
		.safeParse(await runtime.call({ type: 'fields.write', items }, context));

	if (!result.success) {
		throw new PluginCallError("The plugin's field values can't be stored");
	}

	return result.data;
}

/** Runs `fields.read` and checks the answer has a value for every stored value. */
export async function readFieldValues(
	runtime: PluginRuntime,
	items: FieldReadItem[],
	context?: PluginCallContext
): Promise<unknown[][]> {
	if (!items.length) {
		return [];
	}

	const value = await runtime.call({ type: 'fields.read', items }, context);

	if (
		!Array.isArray(value) ||
		value.length !== items.length ||
		value.some(
			(values, index) => !Array.isArray(values) || values.length !== items[index]!.values.length
		)
	) {
		throw new PluginCallError("The plugin's answer to reading field values is not valid");
	}

	return value as unknown[][];
}

/** Rejects with `PluginCallError` when `promise` takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new PluginCallError(`No answer within ${ms / 1000} seconds`)),
			ms
		);
	});

	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
