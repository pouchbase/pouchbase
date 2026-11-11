import { fakePouch } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import plugin from '../plugin.js';
import { fakeContext } from './context.js';

const URL = 'https://pouchbase.test/api/functions/cms-get-posts';

describe('the get-posts function', () => {
	it('answers anyone with a page of the published posts', async () => {
		const pouch = fakePouch(() => ({ items: [{ id: 'p1' }], total: 21, limit: 20, offset: 20 }));
		const { ctx } = fakeContext({ pouch: pouch.client, admin: false });
		const response = await plugin.functions['get-posts'].handler(new Request(`${URL}?page=2`), ctx);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			items: [{ id: 'p1' }],
			total: 21,
			page: 2,
			perPage: 20
		});

		const { path, query } = pouch.requests[0]!;

		expect(path).toBe('/api/db/cms_posts');
		expect(query.get('where')).toContain('status == "published"');
		expect(query.get('where')).toContain('published_at <=');
		expect(query.get('offset')).toBe('20');
	});
});
