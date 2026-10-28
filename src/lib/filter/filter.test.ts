import { describe, expect, it } from 'vitest';

import { parseThumbnailSize } from '#lib/files/thumbnails.js';

import { checkFilter, parseFilter } from './filter';
import { ownerRule, SIGNED_IN_RULE } from './rules';

describe('parseFilter', () => {
	it('parses comparisons, AND, || and parentheses', () => {
		expect(parseFilter('status == "published" AND (views > 10 || author == $user.id)')).toEqual({
			kind: 'and',
			left: {
				kind: 'compare',
				operator: '==',
				left: { kind: 'field', name: 'status', position: 0 },
				right: { kind: 'string', value: 'published' }
			},
			right: {
				kind: 'or',
				left: {
					kind: 'compare',
					operator: '>',
					left: { kind: 'field', name: 'views', position: 27 },
					right: { kind: 'number', value: 10 }
				},
				right: {
					kind: 'compare',
					operator: '==',
					left: { kind: 'field', name: 'author', position: 41 },
					right: { kind: 'user', name: 'id', position: 51 }
				}
			}
		});
	});

	it('parses functions, !, any() and the variables', () => {
		expect(parseFilter('!contains(title, "x")')).toMatchObject({
			kind: 'not',
			expression: {
				kind: 'call',
				name: 'contains',
				args: [
					{ kind: 'field', name: 'title' },
					{ kind: 'string', value: 'x' }
				]
			}
		});
		expect(parseFilter('contains(title, $input.title)')).toMatchObject({
			args: [{ kind: 'field' }, { kind: 'input', name: 'title' }]
		});
		expect(parseFilter('any(editors) == $user.id')).toMatchObject({
			left: { kind: 'any', name: 'editors' }
		});
		expect(parseFilter('contains(any(tags), "re")')).toMatchObject({
			args: [{ kind: 'any', name: 'tags' }, { kind: 'string' }]
		});
		expect(parseFilter('published_at <= now()')).toMatchObject({
			right: { kind: 'call', name: 'now', args: [] }
		});
		expect(parseFilter('created_at >= date_add(now(), -7, "day")')).toMatchObject({
			right: {
				name: 'date_add',
				args: [{ name: 'now' }, { kind: 'number', value: -7 }, { value: 'day' }]
			}
		});
		expect(parseFilter('round(views, 1) == 4.5')).toMatchObject({
			left: { name: 'round', args: [{ name: 'views' }, { value: 1 }] }
		});
		expect(parseFilter('NOT a == 1 && b == 2')).toMatchObject({
			kind: 'and',
			left: { kind: 'not' }
		});
		expect(parseFilter('!(a == 1) OR a != 2')).toMatchObject({
			kind: 'or',
			left: { kind: 'not' },
			right: { operator: '!=' }
		});
	});

	it('takes fields named like functions', () => {
		expect(parseFilter('date == "x" && count > 1')).toMatchObject({
			left: { left: { kind: 'field', name: 'date' } },
			right: { left: { kind: 'field', name: 'count' } }
		});
	});

	it('skips comments', () => {
		expect(parseFilter('# only drafts\nstatus == "draft"')).toMatchObject({ operator: '==' });
	});

	it.each([
		['status = "x"', 'Use `==` to compare'],
		['a == 1 and b == 2', 'Use `&&` or `AND` to combine conditions'],
		['a == 1 or b == 2', 'Use `||` or `OR` to combine conditions'],
		['not a == 1', 'Use `!` or `NOT` to negate a condition'],
		['a == 1 & b == 2', 'Use `&&` to combine conditions'],
		['a == 1 | b == 2', 'Use `||` to combine conditions'],
		['author == @request.auth.id', 'Unexpected character `@`'],
		['$request.id == 1', 'Unknown variable `$request.id`; use $user.<field> or $input.<field>'],
		['any($user.id) == 1', '`any()` takes a field of this collection'],
		['any(a) == any(b)', 'Use `any()` once per comparison'],
		['published_at <= $now', 'Use `now()` for the current date and time'],
		['title contains "x"', 'Use `contains(text, search)` or `!contains(text, search)`'],
		['title NOT contains "x"', 'Use `contains(text, search)` or `!contains(text, search)`'],
		['nope(title) == 1', 'Unknown function `nope()`'],
		['contains(title)', 'Call it as `contains(text, search)`'],
		['round(a, 1, 2) == 1', 'Call it as `round(number, digits?)`'],
		['date_add(now(), 1, "fortnight") > a', 'The unit of `date_add()` is one of "years"'],
		['start_of(now(), unit) > a', 'The unit of `start_of()` is one of "year"'],
		['contains(a, "x") == true', '`contains()` is a condition of its own; use `!` to negate it'],
		['lower(a)', 'Compare `lower()` with a value, e.g. `lower(status) == "draft"`'],
		['a == 1 b == 2', 'Expected `&&` or `||` between conditions'],
		['', 'The condition is empty']
	])('rejects %j', (text, message) => {
		expect(() => parseFilter(text)).toThrow(message);
	});

	it('checks fields', () => {
		expect(checkFilter('nope == 1', { fields: ['title'] })).toMatchObject({
			message: '`nope` is not a field of this collection'
		});
		expect(checkFilter('$user.nope == 1', { fields: [], userFields: ['id'] })).toMatchObject({
			message: '`nope` is not a field of users'
		});
		expect(checkFilter('contains(any(nope), "x")', { fields: ['title'] })).toMatchObject({
			message: '`nope` is not a field of this collection',
			start: 13
		});
		expect(checkFilter('title == $user.id', { fields: ['title'] })).toBeNull();
	});

	it('parses the built-in rules', () => {
		expect(() => parseFilter(SIGNED_IN_RULE)).not.toThrow();
		expect(ownerRule('author')).toBe('author == $user.id');
		expect(ownerRule('editors', true)).toBe('any(editors) == $user.id');
	});
});

describe('parseThumbnailSize', () => {
	it('parses only the current thumbnail syntax', () => {
		expect(parseThumbnailSize('100x100:fit')).toEqual({
			spec: '100x100:fit',
			width: 100,
			height: 100,
			mode: 'fit'
		});
		expect(parseThumbnailSize('100x100f')).toBeNull();
		expect(parseThumbnailSize('100x0:top')).toBeNull();
	});
});
