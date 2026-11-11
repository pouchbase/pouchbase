import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { entry } from 'virtual:pouchbase/function-worker';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SECRET_HEADER } from '#lib/functions/functions.js';

/** A function that reports what it got; `fetch` goes to the fake Pouchbase below. */
const FUNCTION_CODE = `
export default {
	async fetch(request, env, ctx) {
		ctx.waitUntil(Promise.resolve('later'));

		const { pathname } = new URL(request.url);

		if (pathname === '/records') {
			await ctx.pouch.db.posts.findMany();

			return new Response('ok');
		}

		return Response.json({
			user: await ctx.pouch.auth.me(),
			userId: ctx.pouch.session.userId,
			env: Object.keys(env).sort(),
			secret: request.headers.has('${SECRET_HEADER}')
		});
	}
};
`;

const SECRET = 'function-secret';
const API_KEY = 'pbk_function';
const USER = { id: 'user-1', email: 'ada@example.com' };

const ENV = {
	POUCHBASE_FUNCTION_SECRET: SECRET,
	POUCHBASE_URL: 'https://pouchbase.example.com',
	POUCHBASE_API_KEY: API_KEY,
	STRIPE_KEY: 'sk_test'
};

type Worker = {
	fetch(request: Request, env: object, ctx: object): Promise<Response>;
};

let dir: string;
let worker: Worker;
let upstream: { path: string; authorization: string | null }[] = [];
let waited: unknown[] = [];

const realFetch = globalThis.fetch;

function token(sub: string) {
	return `header.${btoa(JSON.stringify({ sub }))}.signature`;
}

function call(path: string, headers: Record<string, string> = {}) {
	return worker.fetch(
		new Request(`https://fn.example.workers.dev${path}`, {
			headers: { [SECRET_HEADER]: SECRET, ...headers }
		}),
		ENV,
		{
			waitUntil: (promise: unknown) => waited.push(promise),
			passThroughOnException: () => undefined
		}
	);
}

beforeAll(async () => {
	if (!('timingSafeEqual' in crypto.subtle)) {
		Object.defineProperty(crypto.subtle, 'timingSafeEqual', {
			configurable: true,
			value: (a: Uint8Array, b: Uint8Array) => a.every((byte, index) => byte === b[index])
		});
	}

	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		const path = new URL(request.url).pathname;
		const authorization = request.headers.get('authorization');

		upstream.push({ path, authorization });

		if (path === '/api/auth/me') {
			return Response.json(USER);
		}

		return Response.json({ items: [], total: 0, limit: 20, offset: 0 });
	}) as typeof fetch;

	dir = await mkdtemp(join(tmpdir(), 'pouchbase-function-'));

	await writeFile(join(dir, 'pouchbase.mjs'), entry.replaceAll('./function.js', './function.mjs'));
	await writeFile(join(dir, 'function.mjs'), FUNCTION_CODE);

	const module = (await import(
		/* @vite-ignore */ pathToFileURL(join(dir, 'pouchbase.mjs')).href
	)) as { default: Worker };

	worker = module.default;
});

beforeEach(() => {
	upstream = [];
	waited = [];
});

afterAll(async () => {
	globalThis.fetch = realFetch;

	await rm(dir, { recursive: true, force: true });
});

describe('the entry of a function Worker', () => {
	it('answers 404 without the secret', async () => {
		const response = await worker.fetch(new Request('https://fn.example.workers.dev/'), ENV, {});

		expect(response.status).toBe(404);
	});

	it('hides the secret from the function, and keeps the rest of env', async () => {
		const body = (await (await call('/')).json()) as { env: string[]; secret: boolean };

		expect(body.secret).toBe(false);
		expect(body.env).toEqual(['POUCHBASE_API_KEY', 'POUCHBASE_URL', 'STRIPE_KEY']);
	});

	it('gives ctx.pouch the signed-in user from the bearer token', async () => {
		const jwt = token(USER.id);
		const body = await (await call('/', { authorization: `Bearer ${jwt}` })).json();

		expect(body).toMatchObject({ user: USER, userId: USER.id });
		expect(upstream).toEqual([{ path: '/api/auth/me', authorization: `Bearer ${jwt}` }]);
	});

	it('leaves ctx.pouch signed out without a token, and does not ask Pouchbase', async () => {
		const body = await (await call('/')).json();

		expect(body).toMatchObject({ user: null, userId: null });
		expect(upstream).toEqual([]);
	});

	it('does not keep a token for the next request', async () => {
		await call('/', { authorization: `Bearer ${token(USER.id)}` });

		const body = await (await call('/')).json();

		expect(body).toMatchObject({ user: null, userId: null });
	});

	it('sends the API key for records, also with a signed-in caller', async () => {
		await call('/records', { authorization: `Bearer ${token(USER.id)}` });

		expect(upstream).toEqual([{ path: '/api/db/posts', authorization: `Bearer ${API_KEY}` }]);
	});

	it('keeps ctx.waitUntil working', async () => {
		await call('/');

		expect(waited).toHaveLength(1);
	});
});
