import type { Field } from './services/fields.service';

import { describe, expect, it } from 'vitest';

import { FilterError } from '#lib/filter/filter.js';

import { checkUserFields, visibleFields } from './hidden-fields';

function field(name: string, overrides: Partial<Field> = {}): Field {
	return {
		id: `${name}-id`,
		collectionId: 'users-id',
		name,
		type: 'text',
		required: false,
		unique: false,
		hidden: false,
		defaultValue: null,
		options: {},
		system: false,
		position: 0,
		createdAt: new Date(0),
		...overrides
	};
}

const FIELDS = [
	field('id', { type: 'id' }),
	field('name'),
	field('role', { hidden: true }),
	field('avatar_data', { type: 'blob' })
];

const names = (fields: Field[]) => fields.map((item) => item.name);

describe('visibleFields', () => {
	it('leaves hidden fields out for app users, signed in or not', () => {
		expect(names(visibleFields(FIELDS, { user: { id: 'ada' } }))).toEqual(['id', 'name']);
		expect(names(visibleFields(FIELDS, { user: null }))).toEqual(['id', 'name']);
	});

	it('keeps hidden fields for admins and service keys (no access)', () => {
		expect(names(visibleFields(FIELDS, undefined))).toEqual(['id', 'name', 'role']);
	});

	it('keeps hidden fields for plugins', () => {
		const access = { plugin: {} } as Parameters<typeof visibleFields>[1];

		expect(names(visibleFields(FIELDS, access))).toEqual(['id', 'name', 'role']);
	});
});

describe('checkUserFields', () => {
	const userFields = visibleFields(FIELDS, { user: null });

	it('allows conditions without $user, or with visible $user fields', () => {
		expect(() => checkUserFields('contains(name, "ada")', userFields)).not.toThrow();
		expect(() => checkUserFields('author == $user.id', userFields)).not.toThrow();
		expect(() => checkUserFields(undefined, userFields)).not.toThrow();
	});

	it('refuses $user fields that are hidden, as if they didn’t exist', () => {
		expect(() => checkUserFields('$user.role == "admin"', userFields)).toThrow(FilterError);
		expect(() => checkUserFields('$user.role == "admin"', userFields)).toThrow(
			'`role` is not a field of users'
		);
		expect(() => checkUserFields('$user.nope == 1', userFields)).toThrow(
			'`nope` is not a field of users'
		);
	});
});
