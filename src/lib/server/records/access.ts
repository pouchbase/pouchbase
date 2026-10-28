import type { Collection } from '../services/collections.service';
import type { Field } from '../services/fields.service';
import type { FilterContext } from '../filter';
import type { PluginGrant } from '../plugins/grant';

import { FilterError, filterValues, parseFilter } from '#lib/filter/filter.js';
import { apiActions, protectedApiFields } from '#lib/filter/rules.js';

import { pluginMay } from '../plugins/grant';

/**
 * Who calls the records API and what they may see of a collection. Hidden fields
 * (`fields.hidden`) are only seen by admins, API keys, plugins and the API rules. For app users
 * (an `access` with `user`), the records API and realtime leave them out, and conditions,
 * `order`, `select` and `include` of their own can't use them.
 */

/**
 * Who calls the records API: the signed-in user (a row of `users`) or `null`, or a plugin with
 * what it may do. Record operations that get an `access` check the collection's API rule for a
 * user and the grant for a plugin; without one (the dashboard) every record is reachable.
 */
export type ApiAccess = { user: Record<string, unknown> | null } | { plugin: PluginGrant };

/** The user an API rule or a filter's `$user` stands for: nobody for a plugin. */
export function accessUser(access: ApiAccess | undefined) {
	return access && 'user' in access ? access.user : null;
}

/**
 * The fields the records API shows `access` and lets it filter, sort and include by: all but blobs,
 * which can be large, and for app users without the hidden fields. Admins, API keys and plugins
 * see every field, and so do the API rules, which the admin wrote.
 */
export function visibleFields(collectionFields: Field[], access: ApiAccess | undefined) {
	const readable = collectionFields.filter((field) => field.type !== 'blob');

	return access && 'user' in access ? readable.filter((field) => !field.hidden) : readable;
}

/**
 * Throws a `FilterError` when a condition of an app user reads a `$user` field that isn't one of
 * `userFields` (the visible fields of `users`), so a filter can't reveal the user's hidden fields.
 */
export function checkUserFields(text: string | null | undefined, userFields: Field[]) {
	if (!text?.includes('$user.')) {
		return;
	}

	const names = new Set(userFields.map((field) => field.name));

	for (const value of filterValues(parseFilter(text))) {
		if (value.kind === 'user' && !names.has(value.name)) {
			throw new FilterError(`\`${value.name}\` is not a field of users`, value.position);
		}
	}
}

/**
 * The fields of `input` that `access` may not write: the protected fields of the collection
 * (a user's `email` and `verified`) and, for app users, the hidden fields they can't read either.
 */
export function protectedWrites(
	collection: Collection,
	collectionFields: Field[],
	access: ApiAccess,
	input: Record<string, unknown> | undefined
) {
	const hidden =
		'user' in access
			? collectionFields.filter((field) => field.hidden).map((field) => field.name)
			: [];

	return [...protectedApiFields(collection), ...hidden].filter((name) => input && name in input);
}

/**
 * The view rule a path through relations (`author.role`) checks on records of `collection`:
 * none without `access` (admins, and API rules, which the admin wrote), `null` when the API
 * doesn't show them to `access`, and otherwise its view rule, as for `?include=`.
 */
function relatedViewRule(collection: Collection, access: ApiAccess | undefined) {
	if (!access) {
		return undefined;
	}

	if (!apiActions(collection).includes('view')) {
		return null;
	}

	if ('plugin' in access) {
		return pluginMay(access.plugin, 'view', collection.name) ? undefined : null;
	}

	return collection.settings?.rules?.view ?? null;
}

/**
 * The collections that relations point to, by id, for conditions with paths such as
 * `post.author.role`; their records are checked against their view rule for `access`.
 */
export function relatedCollections(
	all: { collection: Collection; fields: Field[] }[],
	access: ApiAccess | undefined
): NonNullable<FilterContext['relations']> {
	const byId = new Map(all.map((entry) => [entry.collection.id, entry]));

	return (id) => {
		const entry = byId.get(id);

		if (!entry) {
			return undefined;
		}

		return {
			name: entry.collection.name,
			key: entry.fields.find((field) => field.type === 'id')?.name ?? null,
			// Hidden fields aren't for app users, so their filters can't reach them either.
			fields: visibleFields(entry.fields, access),
			rule: relatedViewRule(entry.collection, access)
		};
	};
}
