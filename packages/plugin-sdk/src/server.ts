/**
 * The plugin itself: `plugin.ts` default-exports `definePlugin({ ... })` with everything the plugin
 * adds, by id: its settings, field types, pages, sign-in providers and routes. The files they live
 * in are up to the plugin; `plugin.ts` imports them, components and icons included.
 *
 * ```ts
 * import { definePlugin } from '@pouchbasejs/plugin-sdk/server';
 *
 * import rating from './fields/rating/field.js';
 * import Stats from './pages/stats.svelte';
 * import * as items from './routes/items.js';
 *
 * export default definePlugin({
 * 	fields: { rating },
 * 	pages: { stats: { title: 'Stats', icon: 'lucide:chart-bar', component: Stats } },
 * 	routes: { '/items': items }
 * });
 * ```
 *
 * `pouchbase-plugin build` runs `plugin.ts` in Node.js to write the manifest, compiles the
 * components it imports for the dashboard, and bundles the rest into the server code: there an
 * imported `.svelte` or `.svg` file is only a `PluginFile`, a reference to the file.
 *
 * The host runs the server code in its own Worker on your Cloudflare account (built-in plugins,
 * which ship with Pouchbase, run inside Pouchbase), so the only ways out are through
 * `PluginContext`: `ctx.fetch` reaches the HTTPS hosts from `permissions.network`, and
 * `ctx.pouch` reaches the records API of Pouchbase, limited to the plugin's own collections and
 * those in `permissions.collections`. The Worker has no access to the database, the storage or
 * Pouchbase's secrets, and its global `fetch` has the same limits as `ctx.fetch`.
 *
 * This module imports only types and uses only `fetch`-style Web APIs, so it bundles into the
 * sandboxed server code as is.
 */

import type { Pouchbase } from '@pouchbasejs/js-sdk';
import type { FieldInputProps, FieldPreviewProps, PageProps } from './ui.js';

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
	/**
	 * A client of the JS SDK (`@pouchbasejs/js-sdk`) for this Pouchbase, signed in as the plugin:
	 * `ctx.pouch.db.posts.findMany({ limit: 10 })`. It reaches the records API of the plugin's own
	 * collections (`collections` of `definePlugin`, by their full name, e.g. `demo_reviews`) and of
	 * those in `permissions.collections`; other collections fail with a `forbidden` error. The
	 * collections' API rules don't apply to it, so check `ctx.user` before acting for a user.
	 * Realtime, files, mail, functions and the schema API aren't available to plugins.
	 */
	pouch: Pouchbase;
};

/** A value read from or written to the field's column. */
export type FieldValue = string | number | Uint8Array | null;

export type FieldValidation = { valid: true } | { valid: false; message: string };

/** SQLite storage class of the column that holds a field's value. */
export type FieldColumn = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';

/**
 * What the server does with a field type's values: the part of a `FieldDefinition` that runs in the
 * server code, which the host calls.
 */
export type FieldTypeHandler = {
	/** Name of the field type in the dashboard, e.g. `Rating`. */
	label?: string;
	/** One sentence about the field type, shown when an admin picks a type. */
	description?: string;
	/** Storage class of the column; fixed for the lifetime of each field of this type. */
	column?: FieldColumn;
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

/**
 * A field type, in `fields` of `definePlugin`: its key is the type (`rating` becomes
 * `<plugin>:rating`). `defineField(...)` types one written in a file of its own.
 */
export type FieldDefinition = FieldTypeHandler & {
	label: string;
	description: string;
	column: FieldColumn;
	/** The control in the record form: `import Input from './input.svelte'`. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	input: PluginComponent<FieldInputProps<any>>;
	/** Shows the value, read-only, in the records grid; missing shows it as text. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	preview?: PluginComponent<FieldPreviewProps<any>>;
	/**
	 * The type's icon in the dashboard, drawn in one color like the built-in types' icons: an
	 * Iconify name such as `lucide:palette`, which the CLI turns into an SVG in the bundle, or an
	 * imported `.svg` file (`import icon from './icon.svg'`). Missing uses a puzzle piece.
	 */
	icon?: PluginIcon;
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
 * Handles requests to a route of the plugin, at `/api/plugins/<plugin>/<path>`. Paths below
 * `/assets/` are the host's: it serves the plugin's images there. Requests from the dashboard come
 * with the admin's session; other requests are anonymous.
 */
export type RouteHandler = (
	request: Request,
	ctx: PluginContext & {
		/** The `:param` segments of the route's path, e.g. `{ id: '42' }` for `/items/:id`. */
		params: Record<string, string>;
	}
) => Response | Promise<Response>;

/** The HTTP methods a route can answer. */
export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * The routes of one path, in `routes` of `definePlugin`: a handler per method it answers. A module
 * that exports them (`export const GET: RouteHandler = ...`) is one: `import * as items from
 * './routes/items.js'`. Its other exports are left alone.
 */
export type RouteModule = Partial<Record<RouteMethod, RouteHandler>>;

/** A dashboard page, in `pages` of `definePlugin`: its key is its path below `/plugins/<id>/`. */
export type PageDefinition = {
	/** The page: `import Stats from './pages/stats.svelte'`. */
	component: PluginComponent<PageProps>;
	/** Title in the dashboard; missing uses the last segment of the path (`monthly` → `Monthly`). */
	title?: string;
	/** Whether the page gets a link in the sidebar; default `true`. */
	navigation?: boolean;
	/**
	 * The page's icon in the sidebar, drawn in one color like the dashboard's own links: an Iconify
	 * name such as `lucide:chart-bar`, or an imported `.svg` file. Missing uses a puzzle piece.
	 */
	icon?: PluginIcon;
};

/**
 * A sign-in provider, in `authProviders` of `definePlugin`: its key is the provider id. Use
 * `createOidcProvider` for an OpenID Connect provider.
 */
export type AuthProviderDefinition = AuthProviderHandler & {
	/**
	 * The logo on the sign-in button, in its own colors: an imported `.svg` file (`import logo from
	 * './logo.svg'`) or an Iconify name such as `logos:gitlab-icon`. Missing shows no logo.
	 */
	icon?: PluginIcon;
};

/**
 * A collection of the plugin, in `collections` of `definePlugin`: its key is its name without the
 * prefix (`reviews` becomes `<plugin>_reviews`, see `pluginCollectionName`). Fields are in the
 * shape of the schema API; a `relation` names its collection with `options.collection`.
 *
 * ```ts
 * defineCollection({
 * 	fields: [
 * 		{ name: 'post', type: 'relation', options: { collection: 'posts' } },
 * 		{ name: 'score', type: 'integer', required: true }
 * 	],
 * 	rules: { list: '', view: '' }
 * });
 * ```
 */
export type CollectionDefinition = {
	fields?: CollectionFieldDefinition[];
	indexes?: { columns: string[]; unique?: boolean }[];
	/**
	 * API rules for app users, per action (`list`, `view`, `create`, `update`, `delete`): `''`
	 * allows everyone, a condition those it matches. Missing or `null` is admins only, so only the
	 * plugin and the dashboard reach the records.
	 */
	rules?: Partial<Record<'list' | 'view' | 'create' | 'update' | 'delete', string | null>>;
};

/** A field of a `CollectionDefinition`. */
export type CollectionFieldDefinition = {
	name: string;
	/** A built-in type (`text`, `integer`, `relation`, ...) or a plugin's `<plugin>:<type>`. */
	type: string;
	required?: boolean;
	unique?: boolean;
	/** The default value as a string, as the dashboard stores it. */
	defaultValue?: string | null;
	/**
	 * The field's options, as `FieldOptions` of the JS SDK; for a `relation`, `collection` names the
	 * related collection: one of the plugin's own by its name in `collections`, else the app's.
	 */
	options?: Record<string, unknown> & { collection?: string };
};

/** Everything the plugin adds, by id: the default export of `plugin.ts`. */
export type PluginDefinition = {
	/**
	 * What an admin can set for the plugin on the Plugins page; the build puts them into the
	 * manifest.
	 */
	settings?: readonly PluginSettingDefinition[];
	/**
	 * Field types by type: `{ rating }` adds `<plugin>:rating`. Lowercase letters, numbers and
	 * underscores.
	 */
	fields?: Record<string, FieldDefinition>;
	/**
	 * Dashboard pages by path: `stats` is `/plugins/<id>/stats`, `'reports/monthly'` a deeper one.
	 * Lowercase words separated by dashes, with slashes between segments. The sidebar lists them in
	 * this order.
	 */
	pages?: Record<string, PageDefinition>;
	/** Sign-in providers by id: `{ gitlab }`. Lowercase words separated by dashes. */
	authProviders?: Record<string, AuthProviderDefinition>;
	/**
	 * Collections by name, without the prefix: `{ reviews }` adds `<plugin>_reviews`. The host
	 * creates them on install and brings them in line on every update, keeping the fields a later
	 * version leaves out; they are deleted, with their records, when the plugin is removed.
	 */
	collections?: Record<string, CollectionDefinition>;
	/**
	 * Routes by path, served at `/api/plugins/<id><path>`: `{ '/items/:id': { GET } }`. A `:name`
	 * segment is a parameter, in `ctx.params`; `'/'` is the plugin's root.
	 */
	routes?: Record<`/${string}`, RouteModule>;
};

/**
 * What the server code of a bundle default-exports, and what the host runs: the handlers of
 * `PluginDefinition` without their components and icons, with a key per route and method
 * (`"GET /items/:id"`). The CLI generates it from `plugin.ts`.
 */
export type ServerDefinition = {
	settings?: readonly PluginSettingDefinition[];
	fields?: Record<string, FieldTypeHandler>;
	authProviders?: Record<string, AuthProviderHandler>;
	routes?: Record<`${RouteMethod} /${string}`, RouteHandler>;
};

/**
 * The plugin, default-exported from `plugin.ts`: returns `definition` unchanged, with literal keys
 * and types, so `typeof plugin` can type `ctx.settings` (see `Register`).
 */
export function definePlugin<const T extends PluginDefinition>(definition: T): T {
	return definition;
}

/** Types a field type written outside `definePlugin`, e.g. in a file of its own; returns it unchanged. */
export function defineField<T extends FieldDefinition>(definition: T): T {
	return definition;
}

/** Types a collection written outside `definePlugin`; returns it unchanged. */
export function defineCollection<T extends CollectionDefinition>(definition: T): T {
	return definition;
}

/** Types a page written outside `definePlugin`; returns it unchanged. */
export function definePage<T extends PageDefinition>(definition: T): T {
	return definition;
}

/** Types an auth provider written outside `definePlugin`; returns it unchanged. */
export function defineAuthProvider<T extends AuthProviderDefinition>(definition: T): T {
	return definition;
}

// Files

/** The key of a `PluginFile`'s path; from `Symbol.for`, so every copy of the SDK has the same one. */
export const PLUGIN_FILE: unique symbol = Symbol.for('pouchbase.plugin-file') as never;

/**
 * A file of the plugin that its server code imports but doesn't run: what an import of a
 * `.svelte` or `.svg` file is when the CLI bundles `plugin.ts`, and in tests with the Vite plugin
 * of `@pouchbasejs/plugin-sdk/vite`. `[PLUGIN_FILE]` is its path in the plugin, e.g.
 * `fields/rating/input.svelte`.
 */
export type PluginFile = { readonly [PLUGIN_FILE]: string };

/**
 * A Svelte component of the plugin with props `Props`, imported in its server code
 * (`import Stats from './stats.svelte'`): typed like the component, so its props are checked, and
 * a `PluginFile` once bundled.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PluginComponent<Props = any> =
	PluginFile | ((internals: never, props: Props) => unknown);

/** An Iconify name such as `lucide:palette`, or an imported `.svg` file. */
export type PluginIcon = string | PluginFile;

/** The path in the plugin of a `PluginFile`, e.g. `pages/stats.svelte`; `null` for anything else. */
export function pluginFilePath(value: unknown): string | null {
	if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
		return null;
	}

	const path = (value as Partial<PluginFile>)[PLUGIN_FILE];

	return typeof path === 'string' ? path : null;
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
