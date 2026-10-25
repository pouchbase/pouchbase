/**
 * The server side of a plugin: `defineField(...)` in `fields/<type>/field.ts`,
 * `defineAuthProvider(...)` in `auth/<id>/provider.ts` and `export const GET` (and the other
 * methods) in `routes/<path>.ts`, and the settings of `definePlugin({ settings })` in `plugin.ts`,
 * which `pouchbase-plugin build` combines into one
 * `definePlugin({ ... })` (in the legacy layout, the file the manifest's `server` points to
 * default-exports it). The host runs it in its own Worker on your Cloudflare account
 * (built-in plugins, which ship with Pouchbase, run inside Pouchbase), so the only way out is
 * through `PluginContext`: `ctx.fetch` reaches the HTTPS hosts from `permissions.network`, and
 * nothing else. The Worker has no bindings, and its global `fetch` has the same limits.
 *
 * Every key of `fields` and `authProviders` matches a contribution in the manifest.
 *
 * This module imports only `./ui.js` (for `definePage`) and uses only `fetch`-style Web APIs, so it
 * bundles into the sandboxed server code as is.
 */

export type PluginLogger = {
	info(message: string, data?: unknown): void;
	warn(message: string, data?: unknown): void;
	error(message: string, data?: unknown): void;
};

/** How a setting is entered and checked; see `PluginSettingDefinition.type`. */
export type PluginSettingKind = 'text' | 'secret' | 'number' | 'boolean' | 'url';

/**
 * A setting of the plugin, in `definePlugin({ settings: [...] })` of `plugin.ts`: the dashboard
 * builds an input for it on the Plugins page, and the server code reads the value with
 * `ctx.settings.get(key)`.
 */
export type PluginSettingDefinition = {
	/** `api_key`, `region`: lowercase letters, numbers and underscores; unique. */
	key: string;
	label: string;
	/** One sentence below the input. */
	description?: string;
	/**
	 * `text` (default) and `url` (an absolute URL) are strings, `number` and `boolean` are typed in
	 * the form and come back as a number or a boolean, `secret` is a string that is never shown
	 * again once saved.
	 */
	type?: PluginSettingKind;
	/**
	 * The plugin can't work without it; an admin is asked to fill it in. Until one does,
	 * `ctx.settings.get` returns `null` (unless it has a `default`), and so does its type.
	 */
	required?: boolean;
	/** Used while no value is saved; of the setting's type, not for `secret`. */
	default?: string | number | boolean;
};

/**
 * Register your plugin to type `ctx.settings`: in `plugin.ts`,
 *
 * ```ts
 * declare module '@pouchbasejs/plugin-sdk/server' {
 * 	interface Register {
 * 		plugin: typeof plugin;
 * 	}
 * }
 * ```
 *
 * Without it, `ctx.settings.get` takes any key and returns `string | number | boolean | null`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Register {}

/** The `settings` of the registered plugin, or `never` without a registration. */
export type RegisteredSettings = Register extends {
	plugin: { settings: infer S extends readonly PluginSettingDefinition[] };
}
	? S
	: Register extends { plugin: unknown }
		? readonly []
		: never;

/**
 * What `ctx.settings.get` returns for a setting: a number for `number`, a boolean for `boolean`,
 * else a string; `null` while it has no value, unless it has a `default`. A `required` setting
 * without a `default` is `null` too until an admin saves it.
 */
export type PluginSettingValue<D extends PluginSettingDefinition> =
	| (D extends { type: 'number' } ? number : D extends { type: 'boolean' } ? boolean : string)
	| (D extends { default: string | number | boolean } ? never : null);

/** The value of every setting of `S`, by key, e.g. `{ greeting: string; limit: number | null }`. */
export type SettingValues<S extends readonly PluginSettingDefinition[]> = {
	[D in S[number] as D['key']]: PluginSettingValue<D>;
};

/** Every setting's value by key: typed from the registered plugin, else any key. */
export type PluginSettingValues = [RegisteredSettings] extends [never]
	? Record<string, string | number | boolean | null>
	: SettingValues<RegisteredSettings>;

/** A key of `PluginSettingValues`: the registered plugin's keys, else any string. */
export type PluginSettingKey = keyof PluginSettingValues & string;

/**
 * The plugin's settings as an admin entered them on the Plugins page, parsed by their `type`
 * (`'42'` is `42` for a `number` setting, `'true'` is `true` for a `boolean`). `V` is the values
 * by key; it defaults to those of the registered plugin (see `Register`).
 */
export type PluginSettings<V extends object = PluginSettingValues> = {
	/** The saved value, else the setting's `default`, else `null`. */
	get<K extends keyof V & string>(key: K): Promise<V[K]>;
	/** Every setting's value, the way `get` returns it. */
	getAll(): Promise<V>;
};

/**
 * A saved value (always a string, as `plugin_settings` stores it) as `ctx.settings.get` returns it:
 * a number for `number`, a boolean for `boolean`, the string for the other types. Without a value
 * (`raw` `null` or `undefined`) the setting's `default`, else `null`; so is a value that doesn't
 * parse (a `number` that isn't one).
 */
export function parseSettingValue(
	setting: Pick<PluginSettingDefinition, 'type' | 'default'>,
	raw: string | null | undefined
): string | number | boolean | null {
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

/**
 * `ctx.settings` for the setting definitions and their values (`key` → string): the host builds
 * the plugin context with it, and so can tests. Keys without a definition read as `null`.
 */
export function createPluginSettings(
	definitions: readonly Pick<PluginSettingDefinition, 'key' | 'type' | 'default'>[] | undefined,
	values: Readonly<Record<string, string>> = {}
): PluginSettings {
	const all = () =>
		Object.fromEntries(
			(definitions ?? []).map((setting) => [
				setting.key,
				parseSettingValue(
					setting,
					Object.hasOwn(values, setting.key) ? values[setting.key] : undefined
				)
			])
		);

	return {
		get: async (key: string) => {
			const current = all();

			return Object.hasOwn(current, key) ? current[key] : null;
		},
		getAll: async () => all()
	} as PluginSettings;
}

/**
 * The app user a route request is made for: the user of the request's
 * `Authorization: Bearer <token>`. Passwords and tokens are never part of it.
 */
export type PluginUser = {
	id: string;
	email: string | null;
	name: string | null;
	/** Whether the user verified their email address. */
	verified: boolean;
	/** Id of the avatar in the `files` collection. */
	avatar: string | null;
	/** The other fields of the `users` collection, by name; binary values are left out. */
	fields: Record<string, string | number | boolean | null>;
};

export type PluginContext = {
	plugin: { id: string; version: string };
	/** `fetch`, limited to the hosts in `permissions.network`; other hosts are rejected. */
	fetch: typeof fetch;
	settings: PluginSettings;
	log: PluginLogger;
	/**
	 * Whether the request comes from an admin signed in to the dashboard (a valid admin session on
	 * a same-origin request). `false` for every other request to a route, such as from the API, an
	 * app or another site, and outside routes.
	 */
	admin: boolean;
	/**
	 * In a route: the app user of the request's bearer token, or `null` for a request without one.
	 * Always `null` outside routes.
	 */
	user: PluginUser | null;
};

/** A value read from or written to the field's column. */
export type FieldValue = string | number | Uint8Array | null;

export type FieldValidation = { valid: true } | { valid: false; message: string };

/** SQLite storage class of the column that holds a field's value. */
export type FieldColumn = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';

export type FieldTypeHandler = {
	/** Name of the field type in the dashboard, e.g. `Rating`. */
	label?: string;
	/** One sentence about the field type, shown when an admin picks a type. */
	description?: string;
	/** Storage class of the column; fixed for the lifetime of each field of this type. */
	column?: FieldColumn;
	/**
	 * The type's icon in the dashboard, drawn in one color like the built-in types' icons: an
	 * Iconify name such as `lucide:palette`, which the CLI turns into an SVG in the bundle, or the
	 * path of an `.svg` file relative to `field.ts`. Missing uses `icon.svg` next to `field.ts`, else
	 * a puzzle piece.
	 */
	icon?: string;
	/**
	 * Checks a value from the record form or the API before it is saved. `options` are the field's
	 * settings. Missing accepts every value.
	 */
	validate?(
		value: unknown,
		options: Record<string, unknown>,
		ctx: PluginContext
	): FieldValidation | Promise<FieldValidation>;
	/** Turns a valid value into what is stored in the column. Missing stores it as is. */
	serialize?(value: unknown, ctx: PluginContext): FieldValue | Promise<FieldValue>;
	/** Turns the stored value into what the API returns. Missing returns it as stored. */
	deserialize?(value: FieldValue, ctx: PluginContext): unknown;
};

/** The provider's user, the same shape the built-in providers return. */
export type OAuthProfile = {
	id: string;
	email: string | null;
	/** Only verified emails may link a sign-in to an existing user. */
	emailVerified: boolean;
	name: string | null;
	avatarUrl: string | null;
};

export type AuthProviderHandler = {
	/** Name on the sign-in button, e.g. `GitLab`. */
	label?: string;
	/** Where an admin registers the OAuth app, shown next to the client id and secret. */
	consoleUrl?: string;
	authorizeUrl: string;
	tokenUrl: string;
	scopes: string[];
	/** Send a PKCE code challenge. */
	pkce: boolean;
	/** Fetches the signed-in user with the access token, through `ctx.fetch`. */
	profile(
		accessToken: string,
		credentials: { clientId: string },
		ctx: PluginContext
	): Promise<OAuthProfile>;
};

/**
 * Handles requests to `/api/plugins/<plugin>/<path>`; keys are `"GET /stats"`, `"POST /sync"`.
 * Paths below `/assets/` are the host's: it serves the plugin's images there.
 * Requests from the dashboard come with the admin's session; other requests are anonymous.
 */
export type RouteHandler = (
	request: Request,
	ctx: PluginContext & {
		/** The `:param` segments of the route key, e.g. `{ id: '42' }` for `GET /items/:id`. */
		params: Record<string, string>;
	}
) => Response | Promise<Response>;

/** The HTTP methods a route can answer. */
export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A file of routes for one path: a handler per method it answers, e.g. `export const GET`. */
export type RouteModule = Partial<Record<RouteMethod, RouteHandler>>;

export type PluginDefinition = {
	/**
	 * What an admin can set for the plugin on the Plugins page (`plugin.ts` in the convention
	 * layout); the build puts them into the manifest.
	 */
	settings?: readonly PluginSettingDefinition[];
	fields?: Record<string, FieldTypeHandler>;
	authProviders?: Record<string, AuthProviderHandler>;
	routes?: Record<`${RouteMethod} /${string}`, RouteHandler>;
};

/**
 * A page's metadata and its helper, defined in `@pouchbasejs/plugin-sdk/ui` (which a page can
 * import) and re-exported here for tests and tools.
 */
export { definePage, type PageMeta } from './ui.js';

/**
 * The plugin's own definition, default-exported from `plugin.ts`: `definePlugin({ settings: [...] })`
 * (in the legacy layout, the server entry's default export with `fields`, `authProviders` and
 * `routes`). Returns it unchanged, with literal keys and types, so `typeof plugin` can type
 * `ctx.settings` (see `Register`).
 */
export function definePlugin<const T extends PluginDefinition>(definition: T): T {
	return definition;
}

/** Types a field type handler written outside `definePlugin`; returns it unchanged. */
export function defineField<T extends FieldTypeHandler>(handler: T): T {
	return handler;
}

/** Types an auth provider written outside `definePlugin`; returns it unchanged. */
export function defineAuthProvider<T extends AuthProviderHandler>(handler: T): T {
	return handler;
}

/**
 * GETs JSON from an API with the user's access token, through `ctx.fetch`; for the profile of
 * an auth provider, e.g. `fetchJson<GitHubUser>(ctx, 'https://api.github.com/user', token)`.
 * Sends `Authorization: Bearer <token>`, `Accept: application/json` and a `User-Agent` (some
 * APIs require one); `headers` adds to or overrides them. Throws when the response is not 2xx.
 */
export async function fetchJson<T>(
	ctx: Pick<PluginContext, 'fetch'>,
	url: string,
	accessToken: string,
	headers: Record<string, string> = {}
): Promise<T> {
	const response = await ctx.fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json',
			'User-Agent': 'Pouchbase',
			...headers
		}
	});

	if (!response.ok) {
		throw new Error(`Request failed (${response.status}): ${url}`);
	}

	return (await response.json()) as T;
}

/** The standard claims of an OpenID Connect userinfo response, plus whatever else it has. */
export type OidcClaims = {
	sub: string;
	email?: string;
	/** Some providers send it as a string. */
	email_verified?: boolean | string;
	name?: string;
	preferred_username?: string;
	picture?: string;
	[claim: string]: unknown;
};

export type OidcProviderOptions = {
	authorizeUrl: string;
	tokenUrl: string;
	/** The provider's OpenID Connect userinfo endpoint. */
	userinfoUrl: string;
	/** Default `['openid', 'email', 'profile']`. */
	scopes?: string[];
	/** Send a PKCE code challenge; default `true`. */
	pkce?: boolean;
	/**
	 * Adjusts the profile mapped from the standard claims, e.g. to distrust `email_verified` or
	 * to read a custom claim. Missing returns `profile` as is.
	 */
	mapProfile?(
		claims: OidcClaims,
		profile: OAuthProfile,
		ctx: PluginContext
	): OAuthProfile | Promise<OAuthProfile>;
};

/**
 * An auth provider for an OpenID Connect provider: its profile comes from the userinfo endpoint
 * (`sub`, `email`, `email_verified`, `name`, `picture`).
 *
 * ```ts
 * export default definePlugin({
 * 	authProviders: {
 * 		google: createOidcProvider({
 * 			authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
 * 			tokenUrl: 'https://oauth2.googleapis.com/token',
 * 			userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo'
 * 		})
 * 	}
 * });
 * ```
 *
 * The host of `userinfoUrl` must be in `permissions.network`.
 */
export function createOidcProvider(options: OidcProviderOptions): AuthProviderHandler {
	return {
		authorizeUrl: options.authorizeUrl,
		tokenUrl: options.tokenUrl,
		scopes: options.scopes ?? ['openid', 'email', 'profile'],
		pkce: options.pkce ?? true,
		async profile(accessToken, _credentials, ctx) {
			const claims = await fetchJson<OidcClaims>(ctx, options.userinfoUrl, accessToken);

			if (typeof claims?.sub !== 'string' || !claims.sub) {
				throw new Error(`The userinfo response has no sub claim: ${options.userinfoUrl}`);
			}

			const email = typeof claims.email === 'string' && claims.email ? claims.email : null;
			const profile: OAuthProfile = {
				id: claims.sub,
				email,
				emailVerified:
					email !== null && (claims.email_verified === true || claims.email_verified === 'true'),
				name: claims.name || claims.preferred_username || null,
				avatarUrl: typeof claims.picture === 'string' && claims.picture ? claims.picture : null
			};

			return options.mapProfile ? options.mapProfile(claims, profile, ctx) : profile;
		}
	};
}
