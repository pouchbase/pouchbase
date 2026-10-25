import { defineField } from '@pouchbasejs/plugin-sdk/server';

import Input from './input.svelte';
import Preview from './preview.svelte';
import { FIELD_TYPES } from '../../lib/catalog.js';
import { checkColor } from '../../lib/color.js';

/**
 * The `color` field type (`demo:color` in Pouchbase): a hex color in a `TEXT` column, stored in its
 * long lowercase form, so `#F80`, `f80` and `#ff8800` are the same value. The check lives in
 * `lib/color.ts`, so the field playground page uses the same rules.
 */
export default defineField({
	label: FIELD_TYPES.color.label,
	description: FIELD_TYPES.color.description,
	column: 'TEXT',
	input: Input,
	preview: Preview,
	icon: 'lucide:pipette',
	validate(value) {
		const check = checkColor(value);

		return check.valid ? { valid: true } : check;
	},
	serialize(value) {
		const check = checkColor(value);

		return check.valid ? check.stored : null;
	}
});
