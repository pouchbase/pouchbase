import type { ApiAccess } from './services/records.service';
import type { Field } from './services/fields.service';

import { FilterError, filterValues, parseFilter } from '#lib/filter/filter.js';

/**
 * Hidden fields (`fields.hidden`) are only seen by admins, API keys,
 * plugins and the API rules. For app users (an `access` with `user`), the records API and realtime
 * leave them out, and conditions, `order`, `select` and `include` of their own can't use them.
 */

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
