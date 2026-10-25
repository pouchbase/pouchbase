/**
 * Shared by the `color` field type and its input and preview. Import it as `../../lib/color.js`, its
 * name in the bundle.
 */

import type { Check } from './check.js';

export const DEFAULT_COLOR = '#000000';

export const COLOR_MESSAGE = 'Enter a hex color, such as #ff8800';

/** One click away in the input. */
export const PRESETS = [
	{ name: 'Red', value: '#ef4444' },
	{ name: 'Orange', value: '#f97316' },
	{ name: 'Amber', value: '#f59e0b' },
	{ name: 'Green', value: '#22c55e' },
	{ name: 'Teal', value: '#14b8a6' },
	{ name: 'Blue', value: '#3b82f6' },
	{ name: 'Indigo', value: '#6366f1' },
	{ name: 'Purple', value: '#a855f7' },
	{ name: 'Pink', value: '#ec4899' },
	{ name: 'Black', value: '#18181b' }
];

const HEX_COLOR = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#F80` or `f80` → `#ff8800`; `null` when the value isn't a hex color. */
export function normalizeColor(value: unknown) {
	if (typeof value !== 'string' || !HEX_COLOR.test(value.trim())) {
		return null;
	}

	const hex = value.trim().replace(/^#/, '').toLowerCase();

	return hex.length === 3 ? `#${[...hex].map((digit) => digit + digit).join('')}` : `#${hex}`;
}

/** A hex color, stored in its long lowercase form. */
export function checkColor(value: unknown): Check<string> {
	const color = normalizeColor(value);

	return color === null ? { valid: false, message: COLOR_MESSAGE } : { valid: true, stored: color };
}
