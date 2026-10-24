import { describe, expect, it } from 'vitest';

import plugin from '../server/index.js';
import { stars } from '../ui/rating.js';

const rating = plugin.fields.rating;

describe('rating', () => {
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

	it('draws stars for the cell', () => {
		expect(stars(3)).toBe('★★★☆☆');
	});
});
