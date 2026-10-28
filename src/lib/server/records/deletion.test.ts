import type { Collection } from '../services/collections.service';
import type { Field } from '../services/fields.service';
import type { RecordContext } from './values';

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/query', () => ({ batchDatabase: vi.fn() }));
vi.mock('../db', () => ({ db: {}, collections: {}, fields: {} }));
vi.mock('../services/files.service', () => ({
	parseThumbnailList: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : []),
	storageKeys: (file: { key: string; thumbnails: string[] }) => [file.key, ...file.thumbnails]
}));

import { linkedSelect, storageKeysOf, unlinkStatement, userCleanupStatements } from './deletion';

/** The statements run on a real SQLite database: they have to find and unlink the right rows. */

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

const AUTHOR = field('author', { type: 'relation', options: { collectionId: 'users-id' } });
const TAGS = field('tags', {
	type: 'relation',
	options: { collectionId: 'tags-id', multiple: true }
});
const POSTS: RecordContext = {
	collection: { id: 'posts-id', name: 'posts', system: false, settings: {} } as Collection,
	fields: [field('id', { type: 'id' }), AUTHOR, TAGS],
	databaseId: 'app'
};

function database() {
	const db = new DatabaseSync(':memory:');

	db.exec('CREATE TABLE "posts" ("id" TEXT PRIMARY KEY, "author" TEXT, "tags" TEXT)');
	db.exec(
		`INSERT INTO "posts" VALUES ('p1', 'ada', '["t1","t2"]'), ('p2', 'grace', '["t2"]'), ('p3', NULL, NULL)`
	);

	return db;
}

describe('linkedSelect', () => {
	it('finds the records that link to the ids through a single or multiple relation', () => {
		const db = database();
		const single = linkedSelect(POSTS, AUTHOR, ['ada']);
		const multiple = linkedSelect(POSTS, TAGS, ['t1']);

		expect(db.prepare(single.sql).all(...single.params)).toEqual([{ id: 'p1' }]);
		expect(db.prepare(multiple.sql).all(...multiple.params)).toEqual([{ id: 'p1' }]);
	});
});

describe('unlinkStatement', () => {
	it('empties a single relation and removes the ids from a multiple one', () => {
		const db = database();
		const single = unlinkStatement(POSTS, AUTHOR, ['ada']);
		const multiple = unlinkStatement(POSTS, TAGS, ['t2']);

		expect(db.prepare(single.sql).all(...single.params)).toEqual([
			{ id: 'p1', author: null, tags: '["t1","t2"]' }
		]);
		expect(db.prepare(multiple.sql).all(...multiple.params)).toEqual([
			{ id: 'p1', author: null, tags: '["t1"]' },
			{ id: 'p2', author: 'grace', tags: null }
		]);
	});
});

describe('cleanup', () => {
	it('removes the auth rows of deleted users and the objects of deleted files', () => {
		expect(userCleanupStatements(['u1', 'u2']).map((statement) => statement.sql)).toEqual([
			'DELETE FROM "_external_auths" WHERE "user_id" IN (?, ?)',
			'DELETE FROM "_passwords" WHERE "user_id" IN (?, ?)'
		]);
		expect(
			storageKeysOf(
				[
					['f1', 'uploads/f1', '["thumb"]'],
					['f2', 'uploads/f2', null]
				],
				['f2']
			)
		).toEqual(['uploads/f2']);
		expect(storageKeysOf([['f1', 'uploads/f1', '["thumb"]']], ['f1'])).toEqual([
			'uploads/f1',
			'thumb'
		]);
	});
});
