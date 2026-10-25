import { defineField } from '@pouchbasejs/plugin-sdk/server';

import { FIELD_TYPES } from '../../lib/catalog.js';
import { checkRating } from '../../lib/rating.js';

/**
 * The `rating` field type (`demo:rating` in Pouchbase). `label`, `description`, `column` and `icon`
 * go into the manifest; the rest runs on the server. The check lives in `lib/rating.ts`, so the
 * field playground page uses the same rules.
 */
export default defineField({
	label: FIELD_TYPES.rating.label,
	description: FIELD_TYPES.rating.description,
	column: 'INTEGER',
	icon: 'lucide:star-half',
	validate(value) {
		const check = checkRating(value);

		return check.valid ? { valid: true } : check;
	},
	serialize(value) {
		const check = checkRating(value);

		return check.valid ? check.stored : null;
	},
	deserialize(value) {
		return value === null ? null : Number(value);
	}
});
