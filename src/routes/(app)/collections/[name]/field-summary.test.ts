import { describe, expect, it } from 'vitest';

import { describeField } from './field-summary';

describe('describeField', () => {
	it('shows the label of a plain field', () => {
		expect(describeField({ type: 'text', options: {}, system: false })).toBe('Text');
	});

	it('names the transform and source of a computed field', () => {
		expect(
			describeField({
				type: 'computed',
				options: { transform: 'slug', source: 'title' },
				system: false
			})
		).toBe('Computed · Slug of title');
	});

	it('shows the generator of a built-in ID field', () => {
		expect(describeField({ type: 'id', options: {}, system: true })).toBe(
			'ID · Random string · Built-in'
		);
	});

	it('marks multiple relations and their delete behaviour', () => {
		expect(
			describeField({
				type: 'relation',
				options: { multiple: true, onDelete: 'cascade' },
				system: false
			})
		).toBe('Relation · Multiple · On delete: Cascade');
	});

	it('names the plugin of a plugin field', () => {
		const pluginTypes = [
			{
				id: 'demo:rating',
				pluginId: 'demo',
				pluginName: 'Demo',
				label: 'Rating',
				description: null,
				column: 'INTEGER' as const
			}
		];

		expect(describeField({ type: 'demo:rating', options: {}, system: false }, pluginTypes)).toBe(
			'Rating · Plugin Demo'
		);
	});

	it('describes a field whose plugin is not installed', () => {
		expect(describeField({ type: 'demo:rating', options: {}, system: false }, [])).toBe(
			'Plugin field · demo:rating · plugin not installed'
		);
	});
});
