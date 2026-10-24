import { describe, expect, it } from 'vitest';

import plugin from '../server/index.js';
import { fakeContext } from './context.js';

const STATUS = 'https://www.githubstatus.com/api/v2/status.json';
const routes = plugin.routes;

function post(body: unknown) {
	return new Request('https://pouchbase.test/api/plugins/demo/echo', {
		method: 'POST',
		body: JSON.stringify(body)
	});
}

describe('GET /info', () => {
	it('falls back to Hello without a greeting setting', async () => {
		const { ctx } = fakeContext();
		const response = await routes['GET /info'](new Request('https://pouchbase.test'), ctx);

		expect(await response.json()).toEqual({ id: 'demo', version: '0.1.0', greeting: 'Hello' });
	});

	it('uses the greeting setting', async () => {
		const { ctx } = fakeContext({}, { greeting: 'Hi' });
		const response = await routes['GET /info'](new Request('https://pouchbase.test'), ctx);

		expect(await response.json()).toMatchObject({ greeting: 'Hi' });
	});
});

describe('POST /echo', () => {
	it('echoes the trimmed message', async () => {
		const { ctx } = fakeContext();
		const response = await routes['POST /echo'](post({ message: ' hi ' }), ctx);

		expect(await response.json()).toEqual({ message: 'hi', length: 2 });
	});

	it.each([{}, { message: '' }, { message: 3 }, null])('answers 422 for %j', async (body) => {
		const { ctx } = fakeContext();
		const response = await routes['POST /echo'](post(body), ctx);

		expect(response.status).toBe(422);
	});
});

describe('GET /github-status', () => {
	it('returns the indicator and description', async () => {
		const { ctx, requests } = fakeContext({
			[STATUS]: { status: { indicator: 'none', description: 'All Systems Operational' } }
		});
		const response = await routes['GET /github-status'](new Request('https://pouchbase.test'), ctx);

		expect(await response.json()).toEqual({
			indicator: 'none',
			description: 'All Systems Operational'
		});
		expect(requests).toEqual([STATUS]);
	});

	it('answers 502 when the API fails', async () => {
		const { ctx } = fakeContext({ [STATUS]: new Response('Down', { status: 503 }) });
		const response = await routes['GET /github-status'](new Request('https://pouchbase.test'), ctx);

		expect(response.status).toBe(502);
	});
});
