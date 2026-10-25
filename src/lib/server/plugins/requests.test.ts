import { describe, expect, it } from 'vitest';

import { hasHooks, passThroughWrite, readInChunks } from './field-values';
import { deliverRouteResponse, isSameOriginRequest, matchPage } from './requests';

describe('isSameOriginRequest', () => {
	it('accepts same-origin and none only', () => {
		expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
		expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': 'none' }))).toBe(true);
		expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': 'same-site' }))).toBe(false);
		expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
		expect(isSameOriginRequest(new Headers())).toBe(false);
	});
});

describe('deliverRouteResponse', () => {
	it('sandboxes the response and adds CORS headers the plugin did not set', async () => {
		const response = deliverRouteResponse(
			new Response('<script>alert(1)</script>', {
				status: 201,
				headers: {
					'content-type': 'text/html',
					'access-control-allow-origin': 'https://app.example.com',
					'content-security-policy': 'default-src *'
				}
			})
		);

		expect(response.status).toBe(201);
		expect(response.headers.get('content-security-policy')).toBe('sandbox');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
		expect(response.headers.get('access-control-allow-methods')).toContain('PATCH');
		expect(await response.text()).toBe('<script>alert(1)</script>');
	});
});

describe('matchPage', () => {
	const pages = [{ path: 'stats' }, { path: 'stats/daily' }, { path: 'reports' }];

	it('picks the longest matching page and passes the rest as params', () => {
		expect(matchPage(pages, 'stats')).toEqual({ page: { path: 'stats' }, params: '' });
		expect(matchPage(pages, '/stats/daily/2026/10/')).toEqual({
			page: { path: 'stats/daily' },
			params: '2026/10'
		});
		expect(matchPage(pages, 'stats/weekly')).toEqual({ page: { path: 'stats' }, params: 'weekly' });
	});

	it('needs whole segments', () => {
		expect(matchPage(pages, 'statsx')).toBeNull();
		expect(matchPage(pages, '')).toBeNull();
	});
});

describe('field values', () => {
	it('knows when a call is needed', () => {
		const handlers = {
			rating: { validate: true, serialize: false, deserialize: false },
			color: { validate: false, serialize: false, deserialize: false }
		};

		expect(hasHooks(handlers, ['rating'], ['validate', 'serialize'])).toBe(true);
		expect(hasHooks(handlers, ['rating', 'color'], ['deserialize'])).toBe(false);
		expect(hasHooks(handlers, ['unknown'], ['validate'])).toBe(false);
		expect(hasHooks(undefined, ['color'], ['deserialize'])).toBe(true);
	});

	it('stores values as they are without hooks', () => {
		expect(
			passThroughWrite([
				{ type: 'rating', name: 'a', options: {}, value: 3 },
				{ type: 'rating', name: 'b', options: {}, value: { stars: 3 } }
			])
		).toEqual([
			{ ok: true, value: 3 },
			{ ok: false, message: 'The value is not valid' }
		]);
	});

	it('reads in chunks and keeps the order', async () => {
		const calls: number[] = [];
		const result = await readInChunks(
			[
				{ type: 'a', values: [1, 2, 3] },
				{ type: 'b', values: [] },
				{ type: 'c', values: [4, 5] }
			],
			async (items) => {
				calls.push(items.reduce((sum, item) => sum + item.values.length, 0));

				return items.map((item) => item.values.map((value) => `${item.type}${value}`));
			},
			2
		);

		expect(result).toEqual([['a1', 'a2', 'a3'], [], ['c4', 'c5']]);
		expect(calls.every((count) => count <= 2)).toBe(true);
	});
});
