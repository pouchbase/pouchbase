import { describe, expect, it } from 'vitest';

import { upgradeSettings, upgradeThumbnailSize } from '#lib/collections/upgrade.js';
import { parseThumbnailSize } from '#lib/files/thumbnails.js';

import { checkFilter, parseFilter } from './filter';
import { upgradeFilter } from './legacy';
import { ownerRule, SIGNED_IN_RULE } from './rules';

describe('parseFilter', () => {
	it('parses comparisons, and, or and parentheses', () => {
		expect(parseFilter('status == "published" and (views > 10 or author == $user.id)')).toEqual({
			kind: 'and',
			left: {
				kind: 'compare',
				operator: '==',
				any: false,
				left: { kind: 'field', name: 'status', position: 0 },
				right: { kind: 'string', value: 'published' }
			},
			right: {
				kind: 'or',
				left: {
					kind: 'compare',
					operator: '>',
					any: false,
					left: { kind: 'field', name: 'views', position: 27 },
					right: { kind: 'number', value: 10 }
				},
				right: {
					kind: 'compare',
					operator: '==',
					any: false,
					left: { kind: 'field', name: 'author', position: 41 },
					right: { kind: 'user', name: 'id', position: 51 }
				}
			}
		});
	});

	it('parses contains, not contains, any() and the variables', () => {
		expect(parseFilter('title not contains "x"')).toMatchObject({ operator: 'not contains' });
		expect(parseFilter('title contains $input.title')).toMatchObject({
			operator: 'contains',
			right: { kind: 'input', name: 'title' }
		});
		expect(parseFilter('any(editors) == $user.id')).toMatchObject({
			any: true,
			left: { kind: 'field', name: 'editors' }
		});
		expect(parseFilter('published_at <= $now')).toMatchObject({ right: { kind: 'now' } });
	});

	it('skips comments', () => {
		expect(parseFilter('# only drafts\nstatus == "draft"')).toMatchObject({ operator: '==' });
	});

	it.each([
		['status = "x"', 'Use `==` to compare'],
		['a == 1 && b == 2', 'Use `and` to combine conditions'],
		['a == 1 || b == 2', 'Use `or` to combine conditions'],
		['author == @request.auth.id', 'Unexpected character `@`'],
		[
			'$request.id == 1',
			'Unknown variable `$request.id`; use $now, $user.<field> or $input.<field>'
		],
		['any($user.id) == 1', '`any()` takes a field of this collection'],
		['a == 1 b == 2', 'Expected `and` or `or` between conditions'],
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
		expect(checkFilter('title == $user.id', { fields: ['title'] })).toBeNull();
	});

	it('parses the built-in rules', () => {
		expect(() => parseFilter(SIGNED_IN_RULE)).not.toThrow();
		expect(ownerRule('author')).toBe('author == $user.id');
		expect(ownerRule('editors', true)).toBe('any(editors) == $user.id');
	});
});

describe('upgradeFilter', () => {
	it.each([
		['author = @request.auth.id', 'author == $user.id'],
		['@request.auth.id != ""', '$user.id != null'],
		['status = "a && b" && views > 10', 'status == "a && b" and views > 10'],
		['(a = 1 || b = 2) && c != 3', '(a == 1 or b == 2) and c != 3'],
		['title ~ "x" && body !~ \'y\'', 'title contains "x" and body not contains \'y\''],
		['editors ?= @request.auth.id', 'any(editors) == $user.id'],
		['tags ?~ "news"', 'any(tags) contains "news"'],
		['@request.body.author = @request.auth.id', '$input.author == $user.id'],
		['published_at <= @now // live posts', 'published_at <= $now # live posts']
	])('upgrades %j', (legacy, current) => {
		expect(upgradeFilter(legacy)).toBe(current);
	});

	it('keeps conditions that are current, empty or invalid', () => {
		expect(upgradeFilter('author == $user.id')).toBe('author == $user.id');
		expect(upgradeFilter('views > 10')).toBe('views > 10');
		expect(upgradeFilter('')).toBe('');
		expect(upgradeFilter('a = = 1')).toBe('a = = 1');
	});
});

describe('upgradeSettings', () => {
	it('upgrades rules and thumbnail sizes', () => {
		expect(
			upgradeSettings({
				rules: { list: '', view: 'author = @request.auth.id', create: null },
				thumbnails: {
					enabled: true,
					sizes: ['100x100', '100x100t', '200x200b', '300x300f', '0x50']
				}
			})
		).toEqual({
			rules: { list: '', view: 'author == $user.id', create: null },
			thumbnails: {
				enabled: true,
				sizes: ['100x100', '100x100:top', '200x200:bottom', '300x300:fit', '0x50']
			}
		});
	});

	it('parses only the current thumbnail syntax', () => {
		expect(parseThumbnailSize('100x100:fit')).toEqual({
			spec: '100x100:fit',
			width: 100,
			height: 100,
			mode: 'fit'
		});
		expect(parseThumbnailSize('100x100f')).toBeNull();
		expect(parseThumbnailSize('100x0:top')).toBeNull();
		expect(upgradeThumbnailSize('100x100f')).toBe('100x100:fit');
	});
});
