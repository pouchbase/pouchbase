import type { PluginFieldLike } from './plugin-fields';

import { describe, expect, it } from 'vitest';

import {
	applyPluginReads,
	applyPluginWrites,
	hasPluginFields,
	planPluginReads,
	planPluginWrites,
	pluginFieldOptions
} from './plugin-fields';

function field(overrides: Partial<PluginFieldLike> & { name: string }): PluginFieldLike {
	return { type: 'demo:rating', required: false, options: {}, ...overrides };
}

const title = field({ name: 'title', type: 'text' });
const rating = field({
	name: 'rating',
	options: { plugin: { label: 'Rating', column: 'INTEGER' } }
});
const color = field({ name: 'color', type: 'paint:color' });
const installed = new Set(['demo:rating', 'paint:color']);

describe('planPluginWrites', () => {
	it('batches submitted values per plugin and leaves built-in fields alone', () => {
		const plan = planPluginWrites(
			[title, rating, color, field({ name: 'stars', options: { multiple: true } })],
			{ title: 'Hello', rating: '4', color: 'red', stars: 2 },
			installed,
			{ creating: false }
		);

		expect(plan).toEqual({
			values: {},
			issues: {},
			batches: [
				{
					pluginId: 'demo',
					fields: ['rating', 'stars'],
					items: [
						{ type: 'rating', name: 'rating', options: {}, value: '4' },
						{ type: 'rating', name: 'stars', options: { multiple: true }, value: 2 }
					]
				},
				{
					pluginId: 'paint',
					fields: ['color'],
					items: [{ type: 'color', name: 'color', options: {}, value: 'red' }]
				}
			]
		});
	});

	it('keeps values that are not submitted', () => {
		expect(planPluginWrites([rating], {}, installed, { creating: false })).toEqual({
			values: {},
			issues: {},
			batches: []
		});
	});

	it('requires a value for a new record unless there is a default', () => {
		const required = field({ name: 'rating', required: true });
		const defaulted = field({
			name: 'score',
			required: true,
			options: { plugin: { label: 'Rating', column: 'INTEGER', default: 3 } }
		});

		expect(
			planPluginWrites([required, defaulted], {}, installed, { creating: true }).issues
		).toEqual({ rating: 'Required' });
	});

	it('stores empty values as null without the plugin, unless required', () => {
		const plan = planPluginWrites(
			[rating, field({ name: 'score', required: true })],
			{ rating: '', score: null },
			installed,
			{ creating: false }
		);

		expect(plan).toEqual({ values: { rating: null }, issues: { score: 'Required' }, batches: [] });
	});

	it('refuses values of fields whose plugin is not installed', () => {
		const plan = planPluginWrites([rating], { rating: '4' }, new Set(), { creating: false });

		expect(plan.issues).toEqual({ rating: 'The plugin demo is not installed' });
		expect(plan.batches).toEqual([]);
	});
});

describe('applyPluginWrites', () => {
	it('stores serialized values and turns refusals into messages', () => {
		const plan = planPluginWrites(
			[rating, color, field({ name: 'stars' }), field({ name: 'blob' })],
			{ rating: '4', color: 'nope', stars: '1', blob: 'x', title: 'Hi' },
			installed,
			{ creating: false }
		);

		const result = applyPluginWrites(plan, [
			[
				{ ok: true, value: 4 },
				{ ok: true, value: 1 },
				{ ok: true, value: new Uint8Array([1]) }
			],
			[{ ok: false, message: 'Not a color' }]
		]);

		expect(result.values).toEqual({ rating: 4, stars: 1 });
		expect(result.issues).toEqual({
			blob: "The plugin turned this value into binary data, which can't be stored",
			color: 'Not a color'
		});
	});

	it('reports values the plugin did not answer for', () => {
		const plan = planPluginWrites([rating], { rating: '4' }, installed, { creating: false });

		expect(applyPluginWrites(plan, [[]]).issues).toEqual({
			rating: 'The plugin did not check this value'
		});
	});
});

describe('planPluginReads and applyPluginReads', () => {
	it('reads the stored values of installed types per plugin and puts the answers back', () => {
		const records: Record<string, unknown>[] = [
			{ title: 'a', rating: 4, color: 'red' },
			{ title: 'b', rating: null, color: 'blue' }
		];
		const batches = planPluginReads([title, rating, color], records, installed);

		expect(batches).toEqual([
			{ pluginId: 'demo', fields: ['rating'], items: [{ type: 'rating', values: [4, null] }] },
			{ pluginId: 'paint', fields: ['color'], items: [{ type: 'color', values: ['red', 'blue'] }] }
		]);

		applyPluginReads(batches, [[[{ stars: 4 }, null]], [['#f00', '#00f']]], records);

		expect(records).toEqual([
			{ title: 'a', rating: { stars: 4 }, color: '#f00' },
			{ title: 'b', rating: null, color: '#00f' }
		]);
	});

	it('leaves out orphaned fields and fields the records do not have', () => {
		const records = [{ title: 'a', rating: 4 }];

		expect(planPluginReads([rating, color], records, new Set(['paint:color']))).toEqual([]);
		expect(planPluginReads([rating], [], installed)).toEqual([]);
	});

	it('keeps the stored values when an answer is missing or incomplete', () => {
		const records: Record<string, unknown>[] = [{ rating: 4 }, { rating: 5 }];
		const batches = planPluginReads([rating], records, installed);

		applyPluginReads(batches, [[[1]]], records);

		expect(records).toEqual([{ rating: 4 }, { rating: 5 }]);
	});
});

describe('helpers', () => {
	it('drops the snapshot from the options the plugin gets', () => {
		expect(
			pluginFieldOptions({ plugin: { label: 'Rating', column: 'INTEGER' }, multiple: true })
		).toEqual({ multiple: true });
	});

	it('knows whether a collection has plugin fields', () => {
		expect(hasPluginFields([title])).toBe(false);
		expect(hasPluginFields([title, rating])).toBe(true);
	});
});
