import { defineField } from '@pouchbasejs/plugin-sdk/server';

import { FIELD_TYPES } from '../../lib/catalog.js';
import { checkPhone } from '../../lib/phone.js';

/**
 * The `phone` field type (`demo:phone` in Pouchbase): an international phone number in a `TEXT`
 * column. The form may contain spaces, dashes, dots and parentheses; it is stored without them
 * (`+31612345678`), so numbers are easy to compare and to call. The check lives in `lib/phone.ts`,
 * so the field playground page uses the same rules.
 */
export default defineField({
	label: FIELD_TYPES.phone.label,
	description: FIELD_TYPES.phone.description,
	column: 'TEXT',
	icon: 'lucide:phone-call',
	validate(value) {
		const check = checkPhone(value);

		return check.valid ? { valid: true } : check;
	},
	serialize(value) {
		const check = checkPhone(value);

		return check.valid ? check.stored : null;
	}
});
