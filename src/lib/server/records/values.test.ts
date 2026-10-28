import type { Field } from '../services/fields.service';

import { describe, expect, it } from 'vitest';

import {
	autoFields,
	decodeValue,
	keyParams,
	parseIds,
	parseValue,
	returning,
	toApiRecord,
	toRecord
} from './values';

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

describe('parseIds', () => {
	it('reads one id, an array and a JSON array, leaving empty ids out', () => {
		expect(parseIds('a')).toEqual(['a']);
		expect(parseIds(['a', '', 'b'])).toEqual(['a', 'b']);
		expect(parseIds('["a","b"]')).toEqual(['a', 'b']);
		expect(parseIds('')).toEqual([]);
		expect(parseIds(null)).toEqual([]);
	});

	it('throws on a JSON array that does not parse', () => {
		expect(() => parseIds('[a')).toThrow();
	});
});

describe('parseValue', () => {
	it('stores booleans as 0/1', () => {
		expect(parseValue(field('done', { type: 'boolean' }), 'on')).toEqual({ value: 1 });
		expect(parseValue(field('done', { type: 'boolean' }), undefined)).toEqual({ value: 0 });
	});

	it('requires a value for required fields and stores empty ones as null', () => {
		expect(parseValue(field('title', { required: true }), '')).toEqual({ error: 'Required' });
		expect(parseValue(field('title'), '')).toEqual({ value: null });
	});

	it('checks numbers, integers, emails, URLs and JSON', () => {
		expect(parseValue(field('n', { type: 'number' }), '1.5')).toEqual({ value: 1.5 });
		expect(parseValue(field('n', { type: 'number' }), 'x')).toEqual({ error: 'Enter a number' });
		expect(parseValue(field('n', { type: 'integer' }), '1.5')).toEqual({
			error: 'Enter a whole number'
		});
		expect(parseValue(field('e', { type: 'email' }), 'ada@example.com')).toEqual({
			value: 'ada@example.com'
		});
		expect(parseValue(field('e', { type: 'email' }), 'ada')).toEqual({
			error: 'Enter an email address'
		});
		expect(parseValue(field('u', { type: 'url' }), 'nope')).toEqual({
			error: 'Enter a URL, e.g. https://example.com'
		});
		expect(parseValue(field('j', { type: 'json' }), { a: 1 })).toEqual({ value: '{"a":1}' });
		expect(parseValue(field('j', { type: 'json' }), '{')).toEqual({ error: 'Enter valid JSON' });
	});

	it('treats dates without a zone as UTC', () => {
		expect(parseValue(field('d', { type: 'date' }), '2026-01-02T03:04')).toEqual({
			value: '2026-01-02T03:04:00.000Z'
		});
		expect(parseValue(field('d', { type: 'date' }), 'yesterday')).toEqual({
			error: 'Enter a valid date'
		});
	});

	it('stores a single relation as its id and multiple ones as a JSON array', () => {
		expect(parseValue(field('author', { type: 'relation' }), ['a'])).toEqual({ value: 'a' });
		expect(
			parseValue(field('tags', { type: 'relation', options: { multiple: true } }), ['a', 'b'])
		).toEqual({ value: '["a","b"]' });
	});

	it('stores list items in the order of the list and refuses unknown ones', () => {
		const list = field('tags', { type: 'list', options: { multiple: true, values: ['a', 'b'] } });

		expect(parseValue(list, ['b', 'a'])).toEqual({ value: '["a","b"]' });
		expect(parseValue(list, ['c'])).toEqual({ error: 'Choose an item from the list' });
	});
});

describe('decodeValue', () => {
	it('returns real values: booleans, parsed JSON and arrays for multiple fields', () => {
		expect(decodeValue(field('done', { type: 'boolean' }), 1)).toBe(true);
		expect(decodeValue(field('j', { type: 'json' }), '{"a":1}')).toEqual({ a: 1 });
		expect(
			decodeValue(field('tags', { type: 'relation', options: { multiple: true } }), '["a"]')
		).toEqual(['a']);
		expect(
			decodeValue(field('tags', { type: 'relation', options: { multiple: true } }), null)
		).toEqual([]);
		expect(decodeValue(field('author', { type: 'relation' }), null)).toBeNull();
	});
});

describe('autoFields', () => {
	it('finds the key, the id generator and the timestamps', () => {
		const auto = autoFields([
			field('id', { type: 'id', options: { generator: 'uuid' } }),
			field('created_at', { type: 'created' }),
			field('updated_at', { type: 'updated' })
		]);

		expect(auto).toMatchObject({
			id: 'id',
			key: 'id',
			created: ['created_at'],
			updated: ['updated_at']
		});
		expect(autoFields([field('title')]).key).toBe('rowid');
	});
});

describe('rows', () => {
	it('converts rows to grid records and API records', () => {
		const fields = [field('title'), field('done', { type: 'boolean' })];

		expect(toRecord(fields, [7, 'Hello', 1])).toEqual({ _key: '7', title: 'Hello', done: 1 });
		expect(toApiRecord(fields, ['Hello', 1])).toEqual({ title: 'Hello', done: true });
		expect(returning('id', [field('id', { type: 'id' }), field('data', { type: 'blob' })])).toBe(
			'"id", "id"'
		);
	});

	it('binds rowid keys as integers', () => {
		expect(keyParams('rowid', ['1', 'x', '2'])).toEqual([1, 2]);
		expect(keyParams('id', ['1', 'x'])).toEqual(['1', 'x']);
	});
});
