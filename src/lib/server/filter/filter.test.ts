import type { Field } from './services/fields.service';

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { FilterContext, RelatedCollection } from './filter';

import { compileFilter, evaluateFilter } from './filter';

/**
 * `evaluateFilter` has to give the answer SQLite gives for the compiled condition on the same row
 * of bound values (what the realtime checks ran before). So every case below runs both ways.
 */

const FIELDS: Pick<Field, 'name' | 'type'>[] = [
	{ name: 'x', type: 'text' },
	{ name: 'y', type: 'text' },
	{ name: 'tags', type: 'relation' },
	{ name: 'created_at', type: 'created' }
];

const VALUES: unknown[] = [
	null,
	undefined,
	'',
	'a',
	'A',
	'b',
	'ab',
	'é',
	'😀',
	'ﬀ',
	'1',
	'10',
	'9',
	0,
	1,
	1.5,
	-2,
	10,
	true,
	false,
	'["a","b"]',
	'[1,2.5,true,null]',
	'[]',
	'"a"',
	'{"a":1}',
	'not json',
	['a', 1]
];

const CONDITIONS = [
	...['==', '!=', '>', '>=', '<', '<='].flatMap((operator) => [
		`x ${operator} y`,
		`x ${operator} "a"`,
		`x ${operator} ""`,
		`x ${operator} null`,
		`x ${operator} 1`,
		`x ${operator} 1.5`,
		`x ${operator} true`,
		`x ${operator} $user.v`,
		`"" ${operator} x`,
		`null ${operator} x`,
		`any(tags) ${operator} $user.v`,
		`any(tags) ${operator} "a"`,
		`any(tags) ${operator} ""`
	]),
	'x == $user.v || y > 1',
	'x > 1 OR y > 1',
	'x > 1 AND y > 1',
	'(x > 1 || x == "a") && y != null',
	'created_at < now()',
	'created_at > now()',
	'created_at < today()',
	'created_at > "2023-11-14"',
	'created_at < "2023-11-14T22:13:20.001Z"',
	'created_at == "2023-11-14T22:13:20Z"',
	'x <= now()',
	'x == today()',
	'"a" == any(tags)',
	'$user.v != any(tags)',
	'!x == "a"',
	'NOT (x > 1 || y > 1)',
	'! NOT x != null'
];

const db = new DatabaseSync(':memory:');

function sqlite(
	condition: string,
	row: Record<string, unknown>,
	user: Record<string, unknown> | null
) {
	const compiled = compileFilter(condition, FIELDS, { user });
	const bind = (value: unknown) =>
		value === undefined || value === null
			? null
			: typeof value === 'boolean'
				? Number(value)
				: typeof value === 'object'
					? JSON.stringify(value)
					: (value as string | number);
	const columns = FIELDS.map((field) => `? AS "${field.name}"`).join(', ');
	const statement = db.prepare(`SELECT 1 FROM (SELECT ${columns}) WHERE ${compiled.sql}`);

	return (
		statement.all(...FIELDS.map((field) => bind(row[field.name])), ...compiled.params).length > 0
	);
}

describe('evaluateFilter', () => {
	it('gives the same answer as SQLite on bound values', () => {
		let compared = 0;

		for (const condition of CONDITIONS) {
			for (const x of VALUES) {
				for (const v of VALUES) {
					const row = { x, y: v, tags: x, created_at: 1_700_000_000_000 };
					const user = { v };
					let expected: boolean;

					try {
						expected = sqlite(condition, row, user);
					} catch {
						// Unknown fields don't compile; the callers deny those before evaluating.
						continue;
					}

					const actual = evaluateFilter(condition, FIELDS, { user }, row);

					if (actual !== undefined) {
						compared++;
						expect({ condition, x, v, result: actual }).toEqual({
							condition,
							x,
							v,
							result: expected
						});
					}
				}
			}
		}

		expect(compared).toBeGreaterThan(15_000);
	});

	it('binds `$user.*` of a signed-out user as SQLite does', () => {
		for (const x of VALUES) {
			for (const condition of ['x == $user.v', 'x != $user.v', 'x > $user.v']) {
				expect(evaluateFilter(condition, FIELDS, { user: null }, { x })).toBe(
					sqlite(condition, { x }, null)
				);
			}
		}

		expect(evaluateFilter('x == $user.v', FIELDS, { user: null }, { x: null })).toBe(false);
	});

	it('leaves functions and nested JSON to SQLite', () => {
		expect(evaluateFilter('contains(x, "a")', FIELDS, { user: null }, { x: 'a' })).toBeUndefined();
		expect(evaluateFilter('lower(x) == "a"', FIELDS, { user: null }, { x: 'a' })).toBeUndefined();
		expect(
			evaluateFilter('any(tags) == "a"', FIELDS, { user: null }, { tags: '[["a"]]' })
		).toBeUndefined();
		expect(
			evaluateFilter('any(tags) == 1', FIELDS, { user: null }, { tags: '[12345678901234567890]' })
		).toBeUndefined();
	});
});

/** Whether the condition matches a row of the collection below, in SQLite. */
function matches(
	condition: string,
	row: Record<string, unknown>,
	context: FilterContext = { user: null }
) {
	const compiled = compileFilter(condition, RECORD_FIELDS, context);
	const columns = RECORD_FIELDS.map((field) => `? AS "${field.name}"`).join(', ');

	return (
		db
			.prepare(`SELECT 1 FROM (SELECT ${columns}) WHERE ${compiled.sql}`)
			.all(
				...RECORD_FIELDS.map((field) => (row[field.name] ?? null) as string | number | null),
				...compiled.params
			).length > 0
	);
}

const RECORD_FIELDS: Pick<Field, 'name' | 'type'>[] = [
	{ name: 'title', type: 'text' },
	{ name: 'views', type: 'number' },
	{ name: 'tags', type: 'list' },
	{ name: 'published_at', type: 'date' },
	{ name: 'created_at', type: 'created' },
	{ name: 'missing', type: 'text' }
];

const POST = {
	title: 'Hello Svelte',
	views: 12.6,
	tags: '["news","release"]',
	// A Wednesday.
	published_at: '2026-10-21T14:30:00.000Z',
	created_at: Date.parse('2026-10-20T08:15:00.000Z')
};

describe('functions', () => {
	it.each([
		['contains(title, "svelte")', true],
		['contains(title, "react")', false],
		['contains(title, "")', true],
		['contains(title, "%")', false],
		['!contains(title, "react")', true],
		['contains(any(tags), "lea")', true],
		['starts_with(title, "hello")', true],
		['starts_with(title, "svelte")', false],
		['ends_with(title, "SVELTE")', true],
		['ends_with(title, "hello")', false],
		['ends_with(title, "")', true],
		['starts_with(title, $user.prefix)', true],
		['ends_with(title, $user.suffix)', true],
		['like(title, "hello _velte")', true],
		['like(title, "%x%")', false],
		['lower(title) == "hello svelte"', true],
		['upper(title) == "HELLO SVELTE"', true],
		['trim(" a ") == "a"', true],
		['length(title) == 12', true],
		['length(missing) == 0', true],
		['round(views) == 13', true],
		['round(views, 1) == 12.6', true],
		['abs(-3) == 3', true],
		['count(tags) == 2', true],
		['count(missing) == 0', true],
		['count(title) == 1', true],
		['year(published_at) == 2026', true],
		['month(published_at) == 10', true],
		['day(published_at) == 21', true],
		['hour(published_at) == 14', true],
		['minute(published_at) == 30', true],
		['weekday(published_at) == 3', true],
		['weekday("2026-10-25") == 7', true],
		['weekday("2026-10-26") == 1', true],
		['year(created_at) == 2026', true],
		['hour(created_at) == 8', true],
		['date(created_at) == "2026-10-20"', true],
		['date(published_at) == "2026-10-21"', true],
		['date_add(published_at, 1, "day") == "2026-10-22T14:30:00.000Z"', true],
		['date_add(published_at, -2, "weeks") == "2026-10-07T14:30:00.000Z"', true],
		['date_add(published_at, 1, "months") == "2026-11-21T14:30:00.000Z"', true],
		['date_add(published_at, $user.days, "days") == "2026-10-24T14:30:00.000Z"', true],
		['date_add(published_at, $user.days, "weeks") == "2026-11-11T14:30:00.000Z"', true],
		['created_at < date_add(published_at, -1, "hours")', true],
		['created_at > date_add(published_at, -2, "days")', true],
		['created_at < published_at', true],
		['created_at > published_at', false],
		['start_of(published_at, "day") == "2026-10-21T00:00:00.000Z"', true],
		['start_of(published_at, "week") == "2026-10-19T00:00:00.000Z"', true],
		['start_of(published_at, "month") == "2026-10-01T00:00:00.000Z"', true],
		['start_of(published_at, "year") == "2026-01-01T00:00:00.000Z"', true],
		['start_of(published_at, "hour") == "2026-10-21T14:00:00.000Z"', true],
		['created_at >= start_of(published_at, "week")', true],
		['created_at >= "2026-10-20"', true],
		['created_at < "2026-10-20T08:15"', false],
		['created_at <= "2026-10-20T10:15:00+02:00"', true],
		['published_at <= now()', true],
		['created_at <= now()', true],
		['published_at < today()', true],
		['date_add(today(), 1, "day") > now()', true],
		['!(views > 100)', true],
		['NOT (missing > 1)', true],
		['!contains(missing, "x")', true]
	])('%s is %s', (condition, expected) => {
		expect(matches(condition, POST, { user: { prefix: 'HEL', suffix: 'lte', days: 3 } })).toBe(
			expected
		);
	});
});

describe('relations', () => {
	const related = new DatabaseSync(':memory:');

	related.exec(`
		CREATE TABLE teams (id TEXT, name TEXT);
		CREATE TABLE users (id TEXT, name TEXT, role TEXT, team TEXT, created_at INTEGER);
		CREATE TABLE posts (id TEXT, title TEXT, author TEXT, editors TEXT, status TEXT);
		CREATE TABLE comments (id TEXT, post TEXT, body TEXT, id_copy TEXT);
		INSERT INTO teams VALUES ('t1', 'Core'), ('t2', 'Docs');
		INSERT INTO users VALUES
			('u1', 'Ada', 'admin', 't1', 1700000000000),
			('u2', 'Linus', 'editor', 't2', 1800000000000),
			('u3', 'Grace', 'hidden', NULL, 1800000000000);
		INSERT INTO posts VALUES
			('p1', 'Hello', 'u1', '["u2","u3"]', 'published'),
			('p2', 'Draft', 'u2', '[]', 'draft'),
			('p3', 'Orphan', NULL, NULL, 'published'),
			('p4', 'Secret', 'u3', '["u1"]', 'published');
		INSERT INTO comments VALUES
			('c1', 'p1', 'Nice', 'x'),
			('c2', 'p2', 'Wow', 'x'),
			('c3', 'p3', 'Hm', 'x'),
			('c4', 'p4', 'Psst', 'x');
	`);

	const relation = (name: string, collectionId: string, multiple = false) => ({
		name,
		type: 'relation' as const,
		options: { collectionId, multiple }
	});
	const text = (name: string) => ({ name, type: 'text' as const });
	const schema: Record<string, RelatedCollection> = {
		teams: { name: 'teams', key: 'id', fields: [text('id'), text('name')] },
		users: {
			name: 'users',
			key: 'id',
			fields: [
				text('id'),
				text('name'),
				text('role'),
				relation('team', 'teams'),
				{ name: 'created_at', type: 'created' }
			]
		},
		posts: {
			name: 'posts',
			key: 'id',
			fields: [
				text('id'),
				text('title'),
				relation('author', 'users'),
				relation('editors', 'users', true),
				text('status')
			]
		}
	};
	const commentFields = [text('id'), relation('post', 'posts'), text('body'), text('id_copy')];

	/** The ids of the comments that match, with the users' view rule set to `userRule`. */
	function comments(condition: string, userRule?: string | null) {
		const compiled = compileFilter(condition, commentFields, {
			user: { id: 'u2' },
			table: 'comments',
			relations: (id) => (id === 'users' ? { ...schema.users, rule: userRule } : schema[id])
		});

		return related
			.prepare(`SELECT id FROM comments WHERE ${compiled.sql} ORDER BY id`)
			.all(...compiled.params)
			.map((row) => row.id);
	}

	it.each([
		['post.status == "published"', ['c1', 'c3', 'c4']],
		['post.author.role == "admin"', ['c1']],
		['post.author.team.name == "Docs"', ['c2']],
		['post.author == null', ['c3']],
		['post.author.role == null', ['c3']],
		['post.author.role != "admin"', ['c2', 'c3', 'c4']],
		['lower(post.author.name) == "ada"', ['c1']],
		['starts_with(post.author.name, "li")', ['c2']],
		['post.author.created_at < "2025-01-01"', ['c1']],
		['post.author == $user.id', ['c2']],
		['post.author.id == $user.id || post.title == "Hello"', ['c1', 'c2']],
		['any(post.editors) == "u3"', ['c1']],
		['any(post.editors.role) == "editor"', ['c1']],
		['any(post.editors.team.name) == "Core"', ['c4']],
		['contains(any(post.editors.name), "ra")', ['c1']],
		['count(post.editors) == 2', ['c1']],
		['!post.author.role == "admin"', ['c2', 'c3', 'c4']]
	])('%s', (condition, expected) => {
		expect(comments(condition)).toEqual(expected);
	});

	it('checks the view rule of related records in `where`', () => {
		const rule = 'role != "hidden"';

		expect(comments('post.author.role == "hidden"', rule)).toEqual([]);
		expect(comments('post.author.name != null', rule)).toEqual(['c1', 'c2']);
		expect(comments('any(post.editors.name) == "Grace"', rule)).toEqual([]);
		expect(comments('any(post.editors.name) == "Linus"', rule)).toEqual(['c1']);
		expect(comments('post.author.id == $user.id', 'id == $user.id')).toEqual(['c2']);
		expect(() => comments('post.author.role == "admin"', null)).toThrow(
			"The API doesn't show records of `users`, so `post.author.role` can't be used"
		);
		expect(comments('post.title == "Hello"', null)).toEqual(['c1']);
	});

	it.each([
		['post.editors.role == "x"', '`editors` holds several records; use `any(post.editors.role)`'],
		['body.x == 1', "`body` is not a relation, so `body.x` doesn't exist"],
		['post.nope == 1', '`nope` is not a field of posts'],
		['post.author.team.name.x == 1', 'Go at most 3 relations deep (`post.author.team.name.x`)']
	])('rejects %j', (condition, message) => {
		expect(() => comments(condition)).toThrow(message);
	});

	it('needs the related collections', () => {
		expect(() => compileFilter('post.status == "x"', commentFields, { user: null })).toThrow(
			"Fields of related records (`post.status`) aren't supported here"
		);
	});

	it('leaves related records to SQLite in memory', () => {
		expect(
			evaluateFilter('post.status == "x"', commentFields, { user: null }, { post: 'p1' })
		).toBeUndefined();
	});
});
