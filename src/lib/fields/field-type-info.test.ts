import { describe, expect, it } from 'vitest';

import { fieldTypeInfo, isOrphaned } from './field-type-info';

const rating = {
	id: 'demo:rating',
	pluginId: 'demo',
	pluginName: 'Demo',
	label: 'Rating',
	description: 'A whole number of stars.',
	column: 'INTEGER' as const
};

describe('fieldTypeInfo', () => {
	it('describes built-in types', () => {
		expect(fieldTypeInfo('text')).toMatchObject({
			label: 'Text',
			icon: 'lucide:type',
			iconUrl: null,
			column: 'TEXT',
			defaultable: true,
			plugin: null,
			orphaned: false
		});
	});

	it('describes an installed plugin type by the plugin', () => {
		const info = fieldTypeInfo({ type: 'demo:rating', options: {} }, [rating]);

		expect(info).toEqual({
			label: 'Rating',
			description: 'A whole number of stars.',
			icon: 'lucide:puzzle',
			iconUrl: null,
			column: 'INTEGER',
			defaultable: true,
			plugin: { id: 'demo', type: 'rating', name: 'Demo' },
			orphaned: false
		});
	});

	it("uses the plugin type's own icon, and the puzzle piece without one", () => {
		const iconUrl = '/api/plugins/demo/assets/ui/icons/lucide/star.svg?v=1.0.0';

		expect(fieldTypeInfo('demo:rating', [{ ...rating, iconUrl }])).toMatchObject({
			icon: 'lucide:puzzle',
			iconUrl
		});
		expect(fieldTypeInfo('demo:rating', [{ ...rating, iconUrl: null }]).iconUrl).toBeNull();
		expect(fieldTypeInfo('demo:rating', []).iconUrl).toBeNull();
	});

	it('keeps the column the field was created with', () => {
		const info = fieldTypeInfo(
			{ type: 'demo:rating', options: { plugin: { label: 'Stars', column: 'TEXT' } } },
			[rating]
		);

		expect(info.column).toBe('TEXT');
		expect(info.label).toBe('Rating');
	});

	it('falls back to the snapshot when the plugin is not installed', () => {
		const field = {
			type: 'demo:rating',
			options: { plugin: { label: 'Rating', column: 'INTEGER' as const } }
		};
		const info = fieldTypeInfo(field, []);

		expect(info).toMatchObject({
			label: 'Rating',
			description: 'Plugin field · demo:rating · plugin not installed',
			column: 'INTEGER',
			defaultable: false,
			plugin: { id: 'demo', type: 'rating', name: null },
			orphaned: true
		});
		expect(isOrphaned(field, [])).toBe(true);
		expect(isOrphaned(field, [rating])).toBe(false);
	});

	it('is never orphaned when the installed types are not known', () => {
		expect(fieldTypeInfo('demo:rating')).toMatchObject({
			label: 'rating',
			column: 'TEXT',
			orphaned: false
		});
	});

	it('marks types it does not know as orphaned', () => {
		expect(fieldTypeInfo('mystery')).toMatchObject({ label: 'mystery', orphaned: true });
	});
});
