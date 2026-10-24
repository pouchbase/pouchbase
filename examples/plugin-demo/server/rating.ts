import { defineField } from '@pouchbasejs/plugin-sdk/server';

import { MAX_RATING } from '../ui/rating.js';

/**
 * The server side of the `rating` field. The record form submits the value as a string and the
 * API may send a number, so `validate` accepts both and `serialize` stores an integer.
 */
export const rating = defineField({
	validate(value) {
		const number = Number(value);

		if (value === '' || !Number.isInteger(number) || number < 1 || number > MAX_RATING) {
			return { valid: false, message: `Choose a rating from 1 to ${MAX_RATING}` };
		}

		return { valid: true };
	},
	serialize(value) {
		return Number(value);
	},
	deserialize(value) {
		return value === null ? null : Number(value);
	}
});
