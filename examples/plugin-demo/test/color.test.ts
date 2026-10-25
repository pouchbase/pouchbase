import { describe, expect, it } from 'vitest';

import color from '../fields/color/field.js';

describe('color', () => {
	it('describes the field type', () => {
		expect(color).toMatchObject({ label: 'Color', column: 'TEXT' });
	});

	it.each(['#ff8800', '#FF8800', '#f80', ' #f80 ', 'ff8800'])('accepts %j', async (value) => {
		expect(await color.validate(value)).toEqual({ valid: true });
	});

	it.each(['', '#ff88', '#gggggg', 'orange', 16746496, null])('refuses %j', async (value) => {
		expect(await color.validate(value)).toEqual({
			valid: false,
			message: 'Enter a hex color, such as #ff8800'
		});
	});

	it('stores the long lowercase form', async () => {
		expect(await color.serialize('#F80')).toBe('#ff8800');
		expect(await color.serialize('#AbCdEf')).toBe('#abcdef');
		expect(await color.serialize('ff8800')).toBe('#ff8800');
	});
});
