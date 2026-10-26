import { describe, expect, it } from 'vitest';

import { isScheduled, parsePostInput, slugify, statusLabel } from '../lib/posts.js';

describe('slugify', () => {
	it('keeps letters and numbers, joined by dashes', () => {
		expect(slugify('Hello, World! 2026')).toBe('hello-world-2026');
		expect(slugify('  Crème brûlée -- recipe ')).toBe('creme-brulee-recipe');
		expect(slugify('!!!')).toBe('');
	});
});

describe('parsePostInput', () => {
	it('fills in the defaults of a new post', () => {
		expect(parsePostInput({ title: ' Hello ' }, { partial: false })).toEqual({
			ok: true,
			value: {
				title: 'Hello',
				content: '',
				excerpt: '',
				slug: '',
				status: 'draft',
				published_at: null,
				featured_image: null,
				sticky: false,
				categories: [],
				tags: []
			}
		});
	});

	it('only takes the fields a change has', () => {
		expect(parsePostInput({ status: 'trash' }, { partial: true })).toEqual({
			ok: true,
			value: { status: 'trash' }
		});
	});

	it('normalizes the slug, the date and the tags', () => {
		const parsed = parsePostInput(
			{
				slug: 'My Post',
				published_at: '2026-10-26T10:00:00+02:00',
				tags: [' svelte ', 'svelte', '', 'cms']
			},
			{ partial: true }
		);

		expect(parsed).toEqual({
			ok: true,
			value: { slug: 'my-post', published_at: '2026-10-26T08:00:00.000Z', tags: ['svelte', 'cms'] }
		});
	});

	it('reports every invalid field', () => {
		const parsed = parsePostInput(
			{
				title: 1,
				slug: '***',
				status: 'live',
				published_at: 'tomorrow',
				featured_image: 'javascript:alert(1)',
				sticky: 'yes',
				categories: [1],
				tags: Array.from({ length: 21 }, (_, i) => `tag ${i}`)
			},
			{ partial: true }
		);

		expect(parsed.ok).toBe(false);
		expect(!parsed.ok && Object.keys(parsed.errors).sort()).toEqual([
			'categories',
			'featured_image',
			'published_at',
			'slug',
			'status',
			'sticky',
			'tags',
			'title'
		]);
	});

	it('refuses a body that is not an object', () => {
		expect(parsePostInput(null, { partial: true }).ok).toBe(false);
		expect(parsePostInput([], { partial: true }).ok).toBe(false);
	});
});

describe('statusLabel', () => {
	const now = new Date('2026-10-26T12:00:00Z');

	it('tells scheduled posts apart from published ones', () => {
		const scheduled = { status: 'published' as const, published_at: '2026-11-01T00:00:00Z' };
		const published = { status: 'published' as const, published_at: '2026-10-01T00:00:00Z' };

		expect(isScheduled(scheduled, now)).toBe(true);
		expect(statusLabel(scheduled, now)).toBe('Scheduled');
		expect(statusLabel(published, now)).toBe('Published');
		expect(statusLabel({ status: 'pending', published_at: null }, now)).toBe('Pending review');
	});
});
