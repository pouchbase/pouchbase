import type { SnapshotCollection } from '#lib/schemas/environments.js';

import { parseManifest } from '@pouchbasejs/plugin-sdk';
import { describe, expect, it } from 'vitest';

import { collectionFields, collectionIndexes } from './collections';
import { pluginMay } from './grant';

function manifest() {
	const result = parseManifest({
		apiVersion: 1,
		id: 'plugin-demo',
		name: 'Demo',
		version: '1.0.0',
		description: 'A demo.',
		license: 'MIT',
		contributes: {
			collections: [
				{
					name: 'reviews',
					fields: [
						{ name: 'post', type: 'relation', options: { collection: 'posts' } },
						{ name: 'parent', type: 'relation', options: { collection: 'reviews' } },
						{ name: 'score', type: 'integer', required: true }
					],
					indexes: [{ columns: ['score'] }]
				}
			]
		}
	});

	if (!result.success) {
		throw new Error(JSON.stringify(result.issues));
	}

	return result.manifest;
}

const ids = new Map([
	['posts', 'posts-id'],
	['plugin_demo_reviews', 'reviews-id']
]);

describe('collectionFields', () => {
	it('adds the default fields and resolves relations by name, own collections first', () => {
		const plugin = manifest();
		const result = collectionFields(plugin, plugin.contributes.collections[0]!, ids, null);

		expect(result).toEqual({
			fields: [
				{ name: 'id', type: 'id', options: { generator: 'random' } },
				{ name: 'created_at', type: 'created', options: {} },
				{ name: 'updated_at', type: 'updated', options: {} },
				{
					name: 'post',
					type: 'relation',
					required: false,
					unique: false,
					defaultValue: null,
					options: { collectionId: 'posts-id' }
				},
				{
					name: 'parent',
					type: 'relation',
					required: false,
					unique: false,
					defaultValue: null,
					options: { collectionId: 'reviews-id' }
				},
				{
					name: 'score',
					type: 'integer',
					required: true,
					unique: false,
					defaultValue: null,
					options: {}
				}
			]
		});
	});

	it('reports a relation to a collection that does not exist', () => {
		const plugin = manifest();
		const result = collectionFields(
			plugin,
			plugin.contributes.collections[0]!,
			new Map([['plugin_demo_reviews', 'reviews-id']]),
			null
		);

		expect(result).toEqual({
			issue: {
				path: 'contributes.collections.reviews.fields.0.options.collection',
				message: 'There is no collection posts'
			}
		});
	});

	it('keeps the fields of an existing collection that the manifest leaves out', () => {
		const plugin = manifest();
		const field = (name: string, type: string, position: number) => ({
			id: `${name}-id`,
			name,
			type: type as SnapshotCollection['fields'][number]['type'],
			required: false,
			unique: false,
			hidden: false,
			defaultValue: null,
			options: {},
			system: false,
			position
		});
		const existing: SnapshotCollection = {
			id: 'reviews-id',
			name: 'plugin_demo_reviews',
			system: false,
			settings: {},
			fields: [field('id', 'id', 0), field('score', 'integer', 1), field('note', 'text', 2)],
			indexes: [{ name: 'idx_note', columns: ['note'], unique: false }]
		};
		const result = collectionFields(plugin, plugin.contributes.collections[0]!, ids, existing);

		expect('fields' in result && result.fields.map((item) => item.name)).toEqual([
			'created_at',
			'updated_at',
			'id',
			'note',
			'post',
			'parent',
			'score'
		]);
		expect(collectionIndexes(plugin.contributes.collections[0]!, existing)).toEqual([
			{ columns: ['score'], unique: false },
			{ columns: ['note'], unique: false }
		]);
	});

	it('keeps the fields that an admin hid hidden on an update', () => {
		const plugin = manifest();
		const hidden = (name: string, type: SnapshotCollection['fields'][number]['type']) => ({
			id: `${name}-id`,
			name,
			type,
			required: false,
			unique: false,
			hidden: true,
			defaultValue: null,
			options: {},
			system: false,
			position: 0
		});
		const existing: SnapshotCollection = {
			id: 'reviews-id',
			name: 'plugin_demo_reviews',
			system: false,
			settings: {},
			fields: [hidden('score', 'integer'), hidden('note', 'text')],
			indexes: []
		};
		const result = collectionFields(plugin, plugin.contributes.collections[0]!, ids, existing);
		const byName =
			'fields' in result ? new Map(result.fields.map((item) => [item.name, item])) : null;

		// Declared by the manifest, and a field the admin added.
		expect(byName?.get('score')?.hidden).toBe(true);
		expect(byName?.get('note')?.hidden).toBe(true);
		expect(byName?.get('post')?.hidden).toBeUndefined();
	});
});

describe('pluginMay', () => {
	const grant = {
		pluginId: 'plugin-demo',
		read: new Set(['posts']),
		write: new Set(['plugin_demo_reviews'])
	};

	it('lets a plugin read what it may read or write, and write only what it may write', () => {
		expect(pluginMay(grant, 'list', 'posts')).toBe(true);
		expect(pluginMay(grant, 'view', 'plugin_demo_reviews')).toBe(true);
		expect(pluginMay(grant, 'create', 'plugin_demo_reviews')).toBe(true);
		expect(pluginMay(grant, 'update', 'posts')).toBe(false);
		expect(pluginMay(grant, 'view', 'users')).toBe(false);
	});

	it('allows every collection for *', () => {
		expect(pluginMay({ ...grant, read: '*' }, 'list', 'users')).toBe(true);
		expect(pluginMay({ ...grant, read: '*' }, 'delete', 'users')).toBe(false);
		expect(pluginMay({ ...grant, write: '*' }, 'delete', 'users')).toBe(true);
	});
});
