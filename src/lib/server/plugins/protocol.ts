import type { FieldValue, OAuthProfile, PluginUser } from '@pouchbasejs/plugin-sdk/server';

import { z } from 'zod';

import { PluginCallError } from './dispatch';

/**
 * What the host sends a plugin's server code and what it expects back. Every plugin with server
 * code has a `PluginRuntime`:
 *
 * - an installed plugin runs in its own Worker on the Cloudflare account (`WorkerRuntime`,
 *   `worker.ts`), reached over workers.dev with a shared secret;
 * - a built-in plugin (`plugins/*` in this repository), and in development an installed one, runs
 *   inside Pouchbase (`InProcessRuntime`, `in-process.ts`).
 *
 * Both answer the same calls and route requests through `dispatch.ts`, which the Worker's entry
 * module (`worker/pouchbase.ts`) and the in-process runtime share. The host does the OAuth
 * redirect and the token exchange itself, from what `describe` returns; only `profile` runs plugin
 * code during a sign-in. The answers are checked here before the host uses them.
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

/** How long a call may take; for a route, until the response starts. */
export const CALL_TIMEOUT = 10_000;

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

const httpsUrl = z.url({ protocol: /^https$/ });

/** What the host needs to run the OAuth flow of a provider; reported by `describe`. */
const providerConfigSchema = z.object({
	authorizeUrl: httpsUrl,
	tokenUrl: httpsUrl,
	scopes: z.array(z.string().min(1).max(200)).max(50),
	pkce: z.boolean()
});

export type ProviderConfig = z.output<typeof providerConfigSchema>;

/** Which hooks a field type implements; the host skips the call when it has none it needs. */
const fieldHandlerSchema = z.object({
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
	/** By field type. */
	fieldHandlers: z.record(z.string(), fieldHandlerSchema)
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
