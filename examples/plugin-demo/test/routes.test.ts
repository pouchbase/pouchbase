import { describe, expect, it } from 'vitest';

import { POST as echo } from '../routes/echo.js';
import { GET as githubStatus } from '../routes/github-status.js';
import { GET as info } from '../routes/info.js';
import { GET as item } from '../routes/items/[id].js';
import { GET as me } from '../routes/me.js';
import { fakeContext } from './context.js';

const STATUS = 'https://www.githubstatus.com/api/v2/status.json';

function post(body: unknown) {
	return new Request('https://pouchbase.test/api/plugins/demo/echo', {
		method: 'POST',
		body: JSON.stringify(body)
	});
}

describe('GET /info', () => {
	it("uses the greeting setting's default while none is saved", async () => {
		const { ctx } = fakeContext();
		const response = await info(new Request('https://pouchbase.test'), ctx);

		expect(await response.json()).toEqual({
			id: 'demo',
			version: '0.1.0',
			greeting: 'Hello',
			settings: { greeting: 'Hello', max_length: 280, shout: false },
			admin: false
		});
	});

	it('uses the saved greeting and reports an admin', async () => {
		const { ctx } = fakeContext({}, { greeting: 'Hi' });
		const response = await info(new Request('https://pouchbase.test'), { ...ctx, admin: true });

		expect(await response.json()).toMatchObject({ greeting: 'Hi', admin: true });
	});
});

describe('POST /echo', () => {
	it('echoes the trimmed message', async () => {
		const { ctx } = fakeContext();
		const response = await echo(post({ message: ' hi ' }), ctx);

		expect(await response.json()).toEqual({ message: 'hi', length: 2 });
	});

	it('shouts and limits the length by the settings, read as a boolean and a number', async () => {
		const { ctx } = fakeContext({}, { shout: 'true', max_length: '5' });

		expect(await (await echo(post({ message: 'hey' }), ctx)).json()).toEqual({
			message: 'HEY',
			length: 3
		});
		expect((await echo(post({ message: 'too long' }), ctx)).status).toBe(422);
	});

	it.each([{}, { message: '' }, { message: 3 }, null])('answers 422 for %j', async (body) => {
		const { ctx } = fakeContext();
		const response = await echo(post(body), ctx);

		expect(response.status).toBe(422);
	});
});

describe('GET /github-status', () => {
	it('returns the indicator and description', async () => {
		const { ctx, requests } = fakeContext({
			[STATUS]: { status: { indicator: 'none', description: 'All Systems Operational' } }
		});
		const response = await githubStatus(new Request('https://pouchbase.test'), ctx);

		expect(await response.json()).toEqual({
			indicator: 'none',
			description: 'All Systems Operational'
		});
		expect(requests.map((request) => request.url)).toEqual([STATUS]);
	});

	it('answers 502 when the API fails', async () => {
		const { ctx } = fakeContext({ [STATUS]: new Response('Down', { status: 503 }) });
		const response = await githubStatus(new Request('https://pouchbase.test'), ctx);

		expect(response.status).toBe(502);
	});
});

describe('GET /me', () => {
	it('answers 401 without a signed-in app user', async () => {
		const { ctx } = fakeContext();
		const response = await me(new Request('https://pouchbase.test'), ctx);

		expect(response.status).toBe(401);
	});

	it('returns the app user of the bearer token', async () => {
		const { ctx } = fakeContext();
		const user = {
			id: 'u1',
			email: 'ada@example.com',
			name: 'Ada',
			verified: true,
			avatar: null,
			fields: {}
		};
		const response = await me(new Request('https://pouchbase.test'), { ...ctx, user });

		expect(await response.json()).toEqual({
			id: 'u1',
			email: 'ada@example.com',
			name: 'Ada',
			verified: true
		});
	});
});

describe('GET /items/:id', () => {
	it('reads the id from ctx.params', async () => {
		const { ctx } = fakeContext();
		const response = await item(new Request('https://pouchbase.test'), {
			...ctx,
			params: { id: 'a b' }
		});

		expect(await response.json()).toEqual({ id: 'a b', url: '/api/plugins/demo/items/a%20b' });
	});
});
