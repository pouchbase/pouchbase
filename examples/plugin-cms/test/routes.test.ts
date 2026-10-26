import { fakePouch } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import type { Post } from '../lib/posts.js';
import * as categories from '../routes/categories.js';
import * as post from '../routes/post.js';
import * as posts from '../routes/posts.js';
import * as site from '../routes/site.js';
import { fakeContext } from './context.js';

const URL = 'https://pouchbase.test/api/plugins/cms';

const STORED: Post = {
	id: 'p1',
	title: 'Hello world',
	slug: 'hello-world',
	content: '<p>Hi</p>',
	excerpt: '',
	status: 'draft',
	published_at: null,
	featured_image: null,
	sticky: false,
	categories: [],
	tags: [],
	created_at: '2026-10-26T08:00:00.000Z',
	updated_at: '2026-10-26T08:00:00.000Z'
};

/**
 * `ctx.pouch` with the posts collection: `slugs` are the slugs other posts have, and `p1` is the
 * one stored post, which a patch changes.
 */
function postsApi(slugs: string[] = []) {
	let stored = { ...STORED };

	return fakePouch(({ method, path, query, body }) => {
		if (path === '/api/db/cms_posts' && method === 'GET') {
			// The slug check asks for id and slug only; the list and the counts for whole posts.
			const items =
				query.get('select') === 'id,slug'
					? slugs.map((slug, i) => ({ id: `other-${i}`, slug }))
					: [stored];

			return { items, total: items.length, limit: 30, offset: 0 };
		}

		if (path === '/api/db/cms_posts' && method === 'POST') {
			stored = { ...STORED, ...(body as object), id: 'p2' };

			return stored;
		}

		if (path === `/api/db/cms_posts/${stored.id}`) {
			if (method === 'PATCH') {
				stored = { ...stored, ...(body as object) };
			}

			return method === 'DELETE' ? new Response(null, { status: 204 }) : stored;
		}

		return Response.json({ message: 'Record not found' }, { status: 404 });
	});
}

function json(method: string, body: unknown) {
	return new Request(`${URL}/posts`, { method, body: JSON.stringify(body) });
}

describe('the post routes', () => {
	it('only answer admins of the dashboard', async () => {
		const pouch = postsApi();
		const { ctx } = fakeContext({ pouch: pouch.client, admin: false });

		expect((await posts.GET(new Request(`${URL}/posts`), ctx)).status).toBe(403);
		expect((await posts.POST(json('POST', { title: 'Hi' }), ctx)).status).toBe(403);
		expect((await post.PATCH(json('PATCH', {}), { ...ctx, params: { id: 'p1' } })).status).toBe(
			403
		);
		expect(pouch.requests).toEqual([]);
	});

	it('list a page of posts with the count of every tab', async () => {
		const pouch = postsApi();
		const { ctx } = fakeContext({ pouch: pouch.client });
		const response = await posts.GET(new Request(`${URL}/posts?status=draft&q=hello`), ctx);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({ total: 1, page: 1, perPage: 20 });
		expect(Object.keys(body.counts)).toEqual(['all', 'draft', 'pending', 'published', 'trash']);
		expect(pouch.requests[0]?.query.get('include')).toBe('categories');
		expect(pouch.requests[0]?.query.get('where')).toContain('contains(title, "hello")');
	});

	it('refuse an unknown tab', async () => {
		const { ctx } = fakeContext({ pouch: postsApi().client });

		expect((await posts.GET(new Request(`${URL}/posts?status=live`), ctx)).status).toBe(422);
	});

	it('give a new post a unique slug from its title', async () => {
		const pouch = postsApi(['hello-world', 'hello-world-2']);
		const { ctx } = fakeContext({ pouch: pouch.client });
		const response = await posts.POST(json('POST', { title: 'Hello, World' }), ctx);

		expect(response.status).toBe(201);
		expect(pouch.requests.find((request) => request.method === 'POST')?.body).toMatchObject({
			title: 'Hello, World',
			slug: 'hello-world-3',
			status: 'draft',
			published_at: null
		});
	});

	it('date a post when it is published', async () => {
		const pouch = postsApi(['hello-world']);
		const { ctx } = fakeContext({ pouch: pouch.client, params: { id: 'p1' } });
		const response = await post.PATCH(json('PATCH', { status: 'published' }), ctx);
		const patch = pouch.requests.find((request) => request.method === 'PATCH');

		expect(response.status).toBe(200);
		expect(patch?.body).toMatchObject({ status: 'published' });
		expect(Date.parse((patch?.body as { published_at: string }).published_at)).not.toBeNaN();
	});

	it('let a post keep its own slug', async () => {
		const pouch = postsApi([]);
		const { ctx } = fakeContext({ pouch: pouch.client, params: { id: 'p1' } });

		await post.PATCH(json('PATCH', { slug: 'hello-world' }), ctx);

		expect(pouch.requests.find((request) => request.method === 'PATCH')?.body).toEqual({
			slug: 'hello-world'
		});
	});

	it('answer 422 with the invalid fields and 404 for a missing post', async () => {
		const pouch = postsApi();
		const { ctx } = fakeContext({ pouch: pouch.client, params: { id: 'p1' } });
		const invalid = await post.PATCH(json('PATCH', { status: 'live' }), ctx);

		expect(invalid.status).toBe(422);
		expect(await invalid.json()).toEqual({
			message: 'Check the post',
			errors: { status: 'One of draft, pending, published, trash' }
		});

		const missing = { ...ctx, params: { id: 'nope' } };

		expect((await post.GET(new Request(`${URL}/posts/nope`), missing)).status).toBe(404);
		expect((await post.DELETE(new Request(`${URL}/posts/nope`), missing)).status).toBe(404);
	});

	it('delete a post', async () => {
		const pouch = postsApi();
		const { ctx } = fakeContext({ pouch: pouch.client, params: { id: 'p1' } });

		expect((await post.DELETE(new Request(`${URL}/posts/p1`), ctx)).status).toBe(204);
		expect(pouch.requests.at(-1)).toMatchObject({ method: 'DELETE', path: '/api/db/cms_posts/p1' });
	});
});

describe('/categories', () => {
	it('answers the category with the same slug instead of adding another', async () => {
		const news = { id: 'c1', name: 'News', slug: 'news' };
		const pouch = fakePouch(({ method }) =>
			method === 'GET' ? { items: [news], total: 1, limit: 1, offset: 0 } : { id: 'c2' }
		);
		const { ctx } = fakeContext({ pouch: pouch.client });
		const response = await categories.POST(
			new Request(`${URL}/categories`, { method: 'POST', body: JSON.stringify({ name: 'news ' }) }),
			ctx
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(news);
		expect(pouch.requests.map((request) => request.method)).toEqual(['GET']);
	});
});

describe('/site', () => {
	it('answers the Site URL setting without a trailing slash', async () => {
		const { ctx } = fakeContext({ settings: { site_url: 'https://example.com/blog/' } });
		const response = await site.GET(new Request(`${URL}/site`), ctx);

		expect(await response.json()).toEqual({ url: 'https://example.com/blog' });
		expect(await (await site.GET(new Request(`${URL}/site`), fakeContext().ctx)).json()).toEqual({
			url: null
		});
	});
});
