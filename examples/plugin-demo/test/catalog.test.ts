import { describe, expect, it } from 'vitest';

import color from '../fields/color/field.js';
import phone from '../fields/phone/field.js';
import rating from '../fields/rating/field.js';
import { FIELD_TYPES, fieldInfo, pageHref } from '../lib/catalog.js';

describe('catalog', () => {
	it('describes the field types as their field.ts does', () => {
		for (const [handler, info] of [
			[color, FIELD_TYPES.color],
			[phone, FIELD_TYPES.phone],
			[rating, FIELD_TYPES.rating]
		] as const) {
			expect(handler).toMatchObject({
				label: info.label,
				description: info.description,
				column: info.column
			});
		}
	});

	it('has samples that every field type accepts', async () => {
		for (const [handler, info] of [
			[color, FIELD_TYPES.color],
			[phone, FIELD_TYPES.phone],
			[rating, FIELD_TYPES.rating]
		] as const) {
			for (const sample of info.samples) {
				expect(await handler.validate!(sample)).toEqual({ valid: true });
			}
		}
	});

	it('builds the props and links the pages use', () => {
		expect(fieldInfo('color', 'brand')).toEqual({
			name: 'brand',
			type: 'demo:color',
			required: false,
			options: {}
		});
		expect(pageHref('fields')).toBe('/plugins/demo/fields');
	});
});
