import type { Field } from '../services/fields.service';

import { describe, expect, it } from 'vitest';

import { FilterError } from '#lib/filter/filter.js';

import { includeTree, parseInclude, relatedIds, selectFields, withIncluded } from './query';

function field(name: string, overrides: Partial<Field> = {}): Field {
	return {
		id: `${name}-id`,
		collectionId: 'posts-id',
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

const FIELDS = [field('id', { type: 'id' }), field('title'), field('author', { type: 'relation' })];

describe('selectFields', () => {
	it('returns every readable field without names, and only the named ones with', () => {
		expect(selectFields(FIELDS, undefined)).toBe(FIELDS);
		expect(selectFields(FIELDS, ['title']).map((item) => item.name)).toEqual(['title']);
	});

	it('refuses unknown fields', () => {
		expect(() => selectFields(FIELDS, ['nope'])).toThrow(FilterError);
	});
});

describe('parseInclude and includeTree', () => {
	it('builds a tree of paths', () => {
		const tree = parseInclude(['author', 'comments.author', 'comments.post']);

		expect([...tree.keys()]).toEqual(['author', 'comments']);
		expect([...tree.get('comments')!.keys()]).toEqual(['author', 'post']);
	});

	it('refuses empty and too deep paths', () => {
		expect(() => parseInclude(['a..b'])).toThrow('Invalid path');
		expect(() => parseInclude(['a.b.c.d'])).toThrow('too deep');
	});

	it('checks that the first level are relation fields', () => {
		expect([...includeTree(FIELDS, ['author']).keys()]).toEqual(['author']);
		expect(() => includeTree(FIELDS, ['title'])).toThrow('not a relation');
		expect(() => includeTree(FIELDS, ['nope'])).toThrow('Unknown field');
	});
});

describe('withIncluded and relatedIds', () => {
	it('adds the included fields to a selection', () => {
		const tree = parseInclude(['author']);

		expect(withIncluded(['title'], tree)).toEqual(['title', 'author']);
		expect(withIncluded(undefined, tree)).toBeUndefined();
	});

	it('reads the ids of a decoded relation value', () => {
		expect(relatedIds('a')).toEqual(['a']);
		expect(relatedIds(['a', 'b'])).toEqual(['a', 'b']);
		expect(relatedIds(null)).toEqual([]);
	});
});
