import type { Field } from '../services/fields.service';
import type { AccessContext, Subject } from './hub-core';

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { authorizationChecks } from './authorize';
import { contextKey } from './hub-core';

/**
 * The checks run on a real SQLite database: the SQL that `compileRule` and `compileFilter` make,
 * on a row of bound values, has to give the same answer as the records API would.
 */

const FIELDS: Pick<Field, 'name' | 'type'>[] = [
	{ name: 'id', type: 'id' },
	{ name: 'title', type: 'text' },
	{ name: 'author', type: 'relation' },
	{ name: 'members', type: 'relation' },
	{ name: 'views', type: 'integer' },
	{ name: 'published', type: 'boolean' },
	{ name: 'created_at', type: 'created' }
];

const ADA: Subject = { kind: 'user', auth: { id: 'ada', role: 'editor' } };
const GRACE: Subject = { kind: 'user', auth: { id: 'grace', role: 'reader' } };
const ANONYMOUS: Subject = { kind: 'anonymous' };
const ADMIN: Subject = { kind: 'admin' };

const POST = {
	id: 'p1',
	title: 'Hello',
	author: 'ada',
	members: '["ada","linus"]',
	views: 12,
	published: 1,
	created_at: 1_700_000_000_000
};

const db = new DatabaseSync(':memory:');

db.exec(
	'CREATE TABLE "posts" ("id" TEXT PRIMARY KEY, "title" TEXT, "author" TEXT, "members" TEXT, "views" INTEGER, "published" INTEGER, "created_at" INTEGER)'
);

function context(subject: Subject, filter: string | null = null): AccessContext {
	return { key: contextKey(subject, filter), subject, filter, expand: null };
}

/** Which of the subjects (by name) may see the event. */
function allowed(
	viewRule: string | null | undefined,
	subjects: Record<string, Subject | [Subject, string]>,
	options: {
		row?: Record<string, unknown>;
		action?: 'create' | 'update' | 'delete';
		viewOffered?: boolean;
		readable?: Pick<Field, 'name' | 'type'>[];
	} = {}
) {
	const contexts = Object.fromEntries(
		Object.entries(subjects).map(([name, value]) => [
			name,
			Array.isArray(value) ? context(value[0], value[1]) : context(value)
		])
	);
	const checks = authorizationChecks({
		action: options.action ?? 'update',
		viewRule,
		viewOffered: options.viewOffered ?? true,
		readable: options.readable ?? FIELDS,
		row: options.row ?? POST,
		table: 'posts',
		key: 'id',
		keyParam: String((options.row ?? POST).id),
		contexts: Object.values(contexts)
	});
	const keys = new Set(
		checks
			.filter((check) =>
				check.statement
					? db.prepare(check.statement.sql).all(...check.statement.params).length > 0
					: check.allowed
			)
			.map((check) => check.key)
	);

	return Object.keys(contexts).filter((name) => keys.has(contexts[name].key));
}

describe('authorizationChecks', () => {
	it('lets nobody but admins through a locked rule', () => {
		expect(allowed(null, { ADA, ANONYMOUS, ADMIN })).toEqual(['ADMIN']);
		expect(allowed(undefined, { ADA, ADMIN })).toEqual(['ADMIN']);
	});

	it('lets everyone through an empty rule, without a query', () => {
		const checks = authorizationChecks({
			action: 'update',
			viewRule: '',
			viewOffered: true,
			readable: FIELDS,
			row: POST,
			table: 'posts',
			key: 'id',
			keyParam: 'p1',
			contexts: [context(ANONYMOUS), context(ADA)]
		});

		expect(checks.every((check) => check.allowed === true)).toBe(true);
	});

	it('lets nobody but admins through when the API offers no view', () => {
		expect(allowed('', { ADA, ADMIN }, { viewOffered: false })).toEqual(['ADMIN']);
	});

	it('checks owner rules on the event’s values', () => {
		expect(allowed('author == $user.id', { ADA, GRACE, ANONYMOUS })).toEqual(['ADA']);
	});

	it('never matches a signed-out user to a record with an empty owner', () => {
		const row = { ...POST, author: null };

		expect(allowed('author == $user.id', { ANONYMOUS }, { row })).toEqual([]);
	});

	it('checks multiple relations with `any()`', () => {
		expect(allowed('any(members) == $user.id', { ADA, GRACE })).toEqual(['ADA']);
	});

	it('checks rules on fields of the signed-in user', () => {
		expect(allowed('$user.role == "editor"', { ADA, GRACE, ANONYMOUS })).toEqual(['ADA']);
	});

	it('combines the rule with the subscriber’s filter', () => {
		expect(
			allowed('published == true', {
				many: [GRACE, 'views > 10'],
				few: [ADA, 'views > 100'],
				admin: [ADMIN, 'views > 100']
			})
		).toEqual(['many']);
	});

	it('hides records the rule doesn’t match (after an update, or on delete)', () => {
		const row = { ...POST, published: 0 };

		expect(allowed('published == true', { ADA, ADMIN }, { row })).toEqual(['ADMIN']);
		expect(allowed('published == true', { ADA }, { action: 'delete' })).toEqual(['ADA']);
	});

	it('compares `$now` with created fields in milliseconds', () => {
		expect(allowed('created_at < $now', { ADA })).toEqual(['ADA']);
		expect(allowed('created_at > $now', { ADA })).toEqual([]);
	});

	it('lets nothing through a rule or filter that no longer compiles', () => {
		expect(allowed('removed == 1', { ADA, ADMIN })).toEqual(['ADMIN']);
		expect(allowed('', { ada: [ADA, 'removed == 1'] })).toEqual([]);
	});

	it('checks rules it can evaluate in memory without a query', () => {
		for (const viewRule of [
			'author == $user.id',
			'any(members) == $user.id',
			'published == true and views > 10'
		]) {
			const checks = authorizationChecks({
				action: 'update',
				viewRule,
				viewOffered: true,
				readable: FIELDS,
				row: POST,
				table: 'posts',
				key: 'id',
				keyParam: 'p1',
				contexts: [context(ADA), context(GRACE), context(ANONYMOUS)]
			});

			expect(checks.every((check) => check.statement === undefined)).toBe(true);
		}
	});

	it('checks contexts the rule can’t tell apart once', () => {
		const LINUS: Subject = { kind: 'user', auth: { id: 'linus', role: 'editor' } };
		const checks = authorizationChecks({
			action: 'update',
			viewRule: '$user.role contains "edit"',
			viewOffered: true,
			readable: FIELDS,
			row: POST,
			table: 'posts',
			key: 'id',
			keyParam: 'p1',
			contexts: [context(ADA), context(LINUS), context(GRACE)]
		});

		expect(checks.map((check) => check.key)).toEqual([
			context(ADA).key,
			context(LINUS).key,
			context(GRACE).key
		]);
		expect(checks[0].statement).toBeDefined();
		expect(checks[1].statement).toBe(checks[0].statement);
		expect(checks[2].statement).not.toBe(checks[0].statement);
		expect(allowed('$user.role contains "edit"', { ADA, LINUS, GRACE })).toEqual(['ADA', 'LINUS']);
	});

	it('keeps subscribers with different filters apart', () => {
		expect(
			allowed('', {
				ada: [ADA, 'views > 10'],
				grace: [GRACE, 'views > 100'],
				anonymous: [ANONYMOUS, 'views > 10']
			})
		).toEqual(['ada', 'anonymous']);
	});

	it('only binds the fields the condition reads', () => {
		const [check] = authorizationChecks({
			action: 'update',
			viewRule: 'author contains $user.id',
			viewOffered: true,
			readable: FIELDS,
			row: POST,
			table: 'posts',
			key: 'id',
			keyParam: 'p1',
			contexts: [context(ADA)]
		});

		expect(check.statement?.params).toEqual(['ada', 'ada']);
	});

	it('evaluates conditions with many fields in memory', () => {
		const readable = Array.from({ length: 60 }, (_, index) => ({
			name: `f${index}`,
			type: 'text' as const
		}));
		const condition = (fields: typeof readable) =>
			fields.map((field) => `${field.name} != "x"`).join(' and ');
		const row = Object.fromEntries([['id', 'p1'], ...readable.map((field) => [field.name, 'y'])]);

		const [update] = authorizationChecks({
			action: 'delete',
			viewRule: condition(readable.slice(0, 30)),
			viewOffered: true,
			readable,
			row,
			table: 'posts',
			key: 'id',
			keyParam: 'p1',
			contexts: [context(ADA, condition(readable.slice(30)))]
		});

		expect(update).toEqual({ key: update.key, allowed: true });
	});

	it('checks the stored record when the condition needs too many parameters', () => {
		const readable = Array.from({ length: 60 }, (_, index) => ({
			name: `f${index}`,
			type: 'text' as const
		}));
		const rule = readable
			.slice(0, 30)
			.map((field) => `${field.name} not contains "x"`)
			.join(' and ');
		const row = Object.fromEntries([['id', 'p1'], ...readable.map((field) => [field.name, 'y'])]);

		const [update] = authorizationChecks({
			action: 'update',
			viewRule: rule,
			viewOffered: true,
			readable,
			row,
			table: 'posts',
			key: 'id',
			keyParam: 'p1',
			contexts: [
				context(
					ADA,
					readable
						.slice(30)
						.map((field) => `${field.name} not contains "x"`)
						.join(' and ')
				)
			]
		});

		expect(update.statement?.sql).toMatch(/^SELECT 1 FROM "posts" WHERE "id" = \?/);

		const [deleted] = authorizationChecks({
			action: 'delete',
			viewRule: rule,
			viewOffered: true,
			readable,
			row,
			table: 'posts',
			key: 'id',
			keyParam: 'p1',
			contexts: [
				context(
					ADA,
					readable
						.slice(30)
						.map((field) => `${field.name} not contains "x"`)
						.join(' and ')
				)
			]
		});

		expect(deleted).toEqual({ key: deleted.key, allowed: false });
	});
});
