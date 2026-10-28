import type { Field } from '../services/fields.service';

import { describe, expect, it } from 'vitest';

import { Failure } from '../failure';
import { planFieldChanges } from './changes';

function field(name: string, patch: Partial<Field> = {}): Field {
	return {
		id: `id-${name}`,
		collectionId: 'c1',
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
		...patch
	};
}

const change = (
	name: string,
	patch: Partial<Parameters<typeof planFieldChanges>[1][number]> = {}
) => ({
	id: `id-${name}`,
	name,
	required: false,
	unique: false,
	remove: false,
	...patch
});

function failureOf(run: () => unknown) {
	try {
		run();
	} catch (error) {
		return error instanceof Failure ? error.error : error;
	}

	return null;
}

describe('planFieldChanges', () => {
	it('orders the listed fields first and keeps the others after them', () => {
		const current = [field('a'), field('b'), field('c')];
		const { kept, removed } = planFieldChanges(current, [change('c'), change('a')]);

		expect(kept.map((plan) => plan.name)).toEqual(['c', 'a', 'b']);
		expect(removed).toEqual([]);
	});

	it('applies the same rules as create: no required computed, no unique multiple or file', () => {
		const current = [
			field('slug', { type: 'computed', options: { transform: 'slug', source: 'title' } }),
			field('tags', { type: 'list', options: { values: ['a'], multiple: true } }),
			field('cover', { type: 'file', options: { collectionId: 'files' } }),
			field('id', { type: 'id' })
		];
		const { kept } = planFieldChanges(current, [
			change('slug', { required: true, unique: true }),
			change('tags', { unique: true }),
			change('cover', { unique: true }),
			change('id', { required: true, unique: true, hidden: true })
		]);

		expect(kept.map(({ required, unique, hidden }) => ({ required, unique, hidden }))).toEqual([
			{ required: false, unique: true, hidden: false },
			{ required: false, unique: false, hidden: false },
			{ required: false, unique: false, hidden: false },
			{ required: false, unique: false, hidden: false }
		]);
	});

	it('only moves system fields', () => {
		const current = [field('email', { system: true, required: true })];
		const { kept } = planFieldChanges(current, [
			change('email', { name: 'mail', required: false, hidden: true, remove: true })
		]);

		expect(kept).toHaveLength(1);
		expect(kept[0]).toMatchObject({ name: 'email', required: true, hidden: false, remove: false });
	});

	it('refuses invalid and duplicate names, naming the field', () => {
		const current = [field('a'), field('b')];

		expect(failureOf(() => planFieldChanges(current, [change('a', { name: 'rowid' })]))).toEqual({
			code: 7001,
			message: 'INVALID_FIELD_NAME',
			data: { id: 'id-a' }
		});
		expect(failureOf(() => planFieldChanges(current, [change('a', { name: 'b' })]))).toEqual({
			code: 7002,
			message: 'FIELD_ALREADY_EXISTS',
			// The unlisted field keeps its name and comes after the renamed one.
			data: { id: 'id-b' }
		});
	});

	it('refuses removing the source of a computed field that stays', () => {
		const current = [
			field('title'),
			field('slug', { type: 'computed', options: { transform: 'slug', source: 'title' } })
		];

		expect(
			failureOf(() =>
				planFieldChanges(current, [change('title', { remove: true }), change('slug')])
			)
		).toEqual({ code: 7012, message: 'FIELD_IN_USE', data: { computed: ['slug'] } });

		// Removing both is fine.
		expect(
			planFieldChanges(current, [
				change('title', { remove: true }),
				change('slug', { remove: true })
			]).removed
		).toHaveLength(2);
	});
});
