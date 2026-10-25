import { describe, expect, it } from 'vitest';

import phone from '../fields/phone/field.js';
import { composePhone, COUNTRIES, countryOf, formatPhone } from '../lib/phone.js';

describe('phone', () => {
	it('describes the field type', () => {
		expect(phone).toMatchObject({ label: 'Phone number', column: 'TEXT' });
	});

	it.each(['+31612345678', '+31 6 12345678', '+1 (555) 123-4567', '+44 20.7946.0958'])(
		'accepts %j',
		async (value) => {
			expect(await phone.validate(value)).toEqual({ valid: true });
		}
	);

	it.each([
		'',
		'0612345678',
		'+0612345678',
		'+3161234567890123',
		'+31 6 1234abcd',
		31612345678,
		null
	])('refuses %j', async (value) => {
		expect(await phone.validate(value)).toEqual({
			valid: false,
			message: 'Enter an international phone number that starts with +, such as +31 6 12345678'
		});
	});

	it('stores the number without separators', async () => {
		expect(await phone.serialize('+1 (555) 123-4567')).toBe('+15551234567');
	});

	it('composes a number from a country and the national number', () => {
		const country = (code: string) => COUNTRIES.find((item) => item.code === code)!;

		expect(composePhone(country('NL'), '06 12345678')).toBe('+31612345678');
		expect(composePhone(country('IT'), '06 1234 5678')).toBe('+390612345678');
		expect(composePhone(null, '+1 555 123 4567')).toBe('+1 555 123 4567');
		expect(composePhone(country('NL'), '')).toBe('');
	});

	it('finds the country by the longest dial code', () => {
		expect(countryOf('+353861234567')?.code).toBe('IE');
		expect(countryOf('+15551234567')?.code).toBe('US');
		expect(countryOf('+999123456789')).toBeNull();
	});

	it('formats a number for the preview', () => {
		expect(formatPhone('+31612345678')).toMatchObject({ text: '+31 612 345 678' });
		expect(formatPhone('+15551234567')).toMatchObject({ text: '+1 555 123 4567' });
		expect(formatPhone('+999123456789')).toEqual({ country: null, text: '+999123456789' });
	});
});
