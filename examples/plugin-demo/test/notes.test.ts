import { fakePouch } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import { GET, POST } from '../routes/notes.js';
import { fakeContext } from './context.js';

const ADA = {
	id: 'u1',
	email: 'ada@example.com',
	name: 'Ada',
	verified: true,
	avatar: null,
	fields: {}
};

/** `ctx.pouch` with an empty notes collection that keeps what is inserted. */
function notesApi() {
	return fakePouch(({ method, path, body }) => {
		if (path !== '/api/db/demo_notes') {
			return new Response(null, { status: 404 });
		}

		return method === 'POST'
			? { id: 'n1', ...(body as object) }
			: { items: [], total: 0, limit: 20, offset: 0 };
	});
}

function post(body: unknown) {
	return new Request('https://pouchbase.test/api/plugins/demo/notes', {
		method: 'POST',
		body: JSON.stringify(body)
	});
}

describe('/notes', () => {
	it("lists the user's notes through ctx.pouch, newest first, with their author", async () => {
		const pouch = notesApi();
		const { ctx } = fakeContext({}, {}, { pouch: pouch.client, user: ADA });
		const response = await GET(new Request('https://pouchbase.test'), ctx);

		expect(response.status).toBe(200);
		expect(pouch.requests[0]?.query.get('where')).toBe('author == "u1"');
		expect(pouch.requests[0]?.query.get('order')).toBe('created_at:desc');
		expect(pouch.requests[0]?.query.get('include')).toBe('author');
	});

	it('adds a note of the user', async () => {
		const pouch = notesApi();
		const { ctx } = fakeContext({}, {}, { pouch: pouch.client, user: ADA });
		const response = await POST(post({ text: ' Remember the milk ' }), ctx);

		expect(response.status).toBe(201);
		expect(pouch.requests[0]).toMatchObject({
			method: 'POST',
			body: { text: 'Remember the milk', author: 'u1' }
		});
	});

	it('answers 401 without a user and 422 without text', async () => {
		const pouch = notesApi();
		const anonymous = fakeContext({}, {}, { pouch: pouch.client }).ctx;
		const signedIn = fakeContext({}, {}, { pouch: pouch.client, user: ADA }).ctx;

		expect((await GET(new Request('https://pouchbase.test'), anonymous)).status).toBe(401);
		expect((await POST(post({ text: '' }), signedIn)).status).toBe(422);
		expect(pouch.requests).toEqual([]);
	});
});
