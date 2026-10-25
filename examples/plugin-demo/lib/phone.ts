/**
 * Shared by the `phone` field type and its input and preview. Import it as `../../lib/phone.js`, its
 * name in the bundle.
 */

import type { Check } from './check.js';

export const PHONE_MESSAGE =
	'Enter an international phone number that starts with +, such as +31 6 12345678';

export type Country = {
	code: string;
	name: string;
	dial: string;
	/** Keeps a leading 0 of the national number, which most countries drop after the dial code. */
	keepZero?: boolean;
};

/** The countries the input offers; the first of a shared dial code (`+1`) is the one shown for it. */
export const COUNTRIES: Country[] = [
	{ code: 'NL', name: 'Netherlands', dial: '31' },
	{ code: 'BE', name: 'Belgium', dial: '32' },
	{ code: 'DE', name: 'Germany', dial: '49' },
	{ code: 'FR', name: 'France', dial: '33' },
	{ code: 'GB', name: 'United Kingdom', dial: '44' },
	{ code: 'IE', name: 'Ireland', dial: '353' },
	{ code: 'ES', name: 'Spain', dial: '34' },
	{ code: 'PT', name: 'Portugal', dial: '351' },
	{ code: 'IT', name: 'Italy', dial: '39', keepZero: true },
	{ code: 'CH', name: 'Switzerland', dial: '41' },
	{ code: 'AT', name: 'Austria', dial: '43' },
	{ code: 'DK', name: 'Denmark', dial: '45' },
	{ code: 'SE', name: 'Sweden', dial: '46' },
	{ code: 'NO', name: 'Norway', dial: '47' },
	{ code: 'PL', name: 'Poland', dial: '48' },
	{ code: 'US', name: 'United States', dial: '1' },
	{ code: 'CA', name: 'Canada', dial: '1' },
	{ code: 'BR', name: 'Brazil', dial: '55' },
	{ code: 'IN', name: 'India', dial: '91' },
	{ code: 'JP', name: 'Japan', dial: '81' },
	{ code: 'AU', name: 'Australia', dial: '61' }
];

/** A country code and 7 to 14 more digits, as in E.164. */
const E164 = /^\+[1-9]\d{6,14}$/;

/** `+31 (6) 12-34.56.78` → `+31612345678`; `null` when the value isn't an international number. */
export function normalizePhone(value: unknown) {
	if (typeof value !== 'string') {
		return null;
	}

	const phone = value.replace(/[\s().-]/g, '');

	return E164.test(phone) ? phone : null;
}

/** The listed country whose dial code starts the number (the longest match), or `null`. */
export function countryOf(phone: string) {
	return (
		COUNTRIES.filter((country) => phone.startsWith(`+${country.dial}`)).sort(
			(a, b) => b.dial.length - a.dial.length
		)[0] ?? null
	);
}

/** `NL` and `06 12345678` → `+31612345678`; without a country, the number is taken as typed. */
export function composePhone(country: Country | null, number: string) {
	const digits = number.replace(/\D/g, '');

	if (!digits) {
		return '';
	}

	if (!country) {
		return number.trim();
	}

	return `+${country.dial}${country.keepZero ? digits : digits.replace(/^0+/, '')}`;
}

/** `+31612345678` → `612 345 678`: the national part in groups of three, the last of up to four. */
export function groupDigits(digits: string) {
	const groups: string[] = [];
	let rest = digits;

	while (rest.length > 4) {
		groups.push(rest.slice(0, 3));
		rest = rest.slice(3);
	}

	return [...groups, rest].filter(Boolean).join(' ');
}

/** `+31612345678` → `+31 612 345 678`, with the country it belongs to. */
export function formatPhone(phone: string) {
	const country = countryOf(phone);

	if (!country) {
		return { country: null, text: phone };
	}

	return {
		country,
		text: `+${country.dial} ${groupDigits(phone.slice(country.dial.length + 1))}`
	};
}

/** An international phone number, stored without separators. */
export function checkPhone(value: unknown): Check<string> {
	const phone = normalizePhone(value);

	return phone === null ? { valid: false, message: PHONE_MESSAGE } : { valid: true, stored: phone };
}
