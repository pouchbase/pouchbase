import { createClient } from '@pouchbasejs/js-sdk';
import type { Pouchbase, RecordOf } from '@pouchbasejs/js-sdk';

import { POUCHBASE_API_KEY } from '$app/env/private';
import { POUCHBASE_URL } from '$app/env/public';

import type { Schema as GeneratedSchema } from './pouchbase.types';

/**
 * The Pouchbase instance behind the site: accounts are its `users`, and the plugin registry keeps
 * its data in four collections whose API rules are all Admins only. The site writes and reads
 * them with an API key (`admin()`), which acts as an admin, after checking who may do what itself. See the README for
 * how to set up the collections.
 *
 * The types of the collections are generated into `pouchbase.types.ts` by `pnpm types`; run it
 * after changing a collection. Relations are typed from it too: with `include: { owner: true }`,
 * `owner` is the user instead of its id.
 */

export type * from './pouchbase.types';

/**
 * A schema entry with the JSON fields in `J` typed by what the site stores in them; the generated
 * types only know them as `JsonValue`.
 */
type WithJson<E, J> = E extends { $record: infer R; $create: infer C }
	? Omit<E, '$record' | '$create'> & {
			$record: Omit<R, keyof J> & J;
			$create: Omit<C, keyof J> & Partial<J>;
		}
	: never;

/** The generated schema, with the JSON fields of the registry typed. */
export type Schema = Omit<GeneratedSchema, 'plugins' | 'plugin_versions'> & {
	plugins: WithJson<
		GeneratedSchema['plugins'],
		{
			keywords: string[] | null;
			/** The manifest's categories, or the ones implied by what the plugin contributes. */
			categories: string[] | null;
		}
	>;
	plugin_versions: WithJson<
		GeneratedSchema['plugin_versions'],
		{
			/** `collections` is missing for versions published before plugins had it. */
			permissions: {
				network: string[];
				collections?: { read: string[]; write: string[] };
			} | null;
		}
	>;
};

/** A plugin in the registry; `slug` is the manifest's `id`. */
export type PluginRecord = RecordOf<Schema['plugins']>;

/** A published version of a plugin, with the first part of its bundle. */
export type PluginVersionRecord = RecordOf<Schema['plugin_versions']>;

/** A client for the instance, signed in with the user's token when there is one. */
export function pouchbase(token?: string): Pouchbase<Schema> {
	const pouch = createClient<Schema>(POUCHBASE_URL ?? '');

	if (token) {
		pouch.session.begin({ token, userId: '' });
	}

	return pouch;
}

/** A client with the API key, which acts as an admin: API rules don't apply to it. Server-side only. */
export function admin(): Pouchbase<Schema> {
	return createClient<Schema>(POUCHBASE_URL ?? '', { apiKey: POUCHBASE_API_KEY });
}
