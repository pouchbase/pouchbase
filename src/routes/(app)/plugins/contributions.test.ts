import { describe, expect, it } from 'vitest';

import { describeContributions } from './contributions';

describe('describeContributions', () => {
	const summary = {
		fields: [{ type: 'rating', label: 'Rating' }],
		pages: [{ path: 'overview', title: 'Demo' }],
		authProviders: [],
		routes: ['GET /info', 'POST /echo', 'GET /github-status'],
		settings: [
			{ key: 'greeting', label: 'Greeting' },
			{ key: 'token', label: 'Token' }
		]
	};

	it('names fields, pages and providers and counts the rest', () => {
		expect(describeContributions(summary)).toBe(
			'1 field type (Rating), 1 page (Demo), 3 routes, 2 settings'
		);
	});

	it('only counts without names', () => {
		expect(describeContributions(summary, { names: false })).toBe(
			'1 field type, 1 page, 3 routes, 2 settings'
		);
	});

	it('uses plurals and skips missing lists', () => {
		expect(
			describeContributions({
				authProviders: [
					{ id: 'a', label: 'A' },
					{ id: 'b', label: 'B' }
				]
			})
		).toBe('2 sign-in providers (A, B)');
	});

	it('is empty without a summary or contributions', () => {
		expect(describeContributions(undefined)).toBe('');
		expect(describeContributions({})).toBe('');
	});
});
