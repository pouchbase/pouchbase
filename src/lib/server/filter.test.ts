import type { Field } from './services/fields.service';

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

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
	'x == $user.v or y > 1',
	'x > 1 or y > 1',
	'x > 1 and y > 1',
	'(x > 1 or x == "a") and y != null',
	'created_at < $now',
	'created_at > $now'
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

	it('leaves `contains` and nested JSON to SQLite', () => {
		expect(evaluateFilter('x contains "a"', FIELDS, { user: null }, { x: 'a' })).toBeUndefined();
		expect(
			evaluateFilter('any(tags) == "a"', FIELDS, { user: null }, { tags: '[["a"]]' })
		).toBeUndefined();
		expect(
			evaluateFilter('any(tags) == 1', FIELDS, { user: null }, { tags: '[12345678901234567890]' })
		).toBeUndefined();
	});
});
