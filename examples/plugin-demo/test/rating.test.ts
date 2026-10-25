import { describe, expect, it } from 'vitest';

import rating from '../fields/rating/field.js';
import { checkRating, RATING_LABELS } from '../lib/rating.js';

describe('rating', () => {
	it('describes the field type', () => {
		expect(rating).toMatchObject({ label: 'Rating', column: 'INTEGER' });
	});

	it.each([1, 5, '3'])('accepts %j', async (value) => {
		expect(await rating.validate(value)).toEqual({ valid: true });
	});

	it.each([0, 6, 2.5, '', 'five', null])('refuses %j', async (value) => {
		expect(await rating.validate(value)).toEqual({
			valid: false,
			message: 'Choose a rating from 1 to 5'
		});
	});

	it('stores and returns a number', async () => {
		expect(await rating.serialize('4')).toBe(4);
		expect(rating.deserialize(4)).toBe(4);
		expect(rating.deserialize(null)).toBeNull();
	});

	it('shares its check with the field playground', () => {
		expect(checkRating('4')).toEqual({ valid: true, stored: 4 });
		expect(checkRating(0)).toEqual({ valid: false, message: 'Choose a rating from 1 to 5' });
		expect(RATING_LABELS).toHaveLength(5);
	});
});
