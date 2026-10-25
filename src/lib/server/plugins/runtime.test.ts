import type { PluginDefinition } from '@pouchbasejs/plugin-sdk/server';
import type { PluginRuntime } from './runtime';

import { resolveSettings } from '@pouchbasejs/plugin-sdk';
import { describe, expect, it } from 'vitest';

import { describeEmbedded, embeddedPlugin } from './embedded';
import { matchRoute } from './routes';
import {
	describeResultSchema,
	dispatch,
	dispatchRoute,
	EMPTY_CALL_CONTEXT,
	parseProfile,
	PluginCallError,
	pluginContext,
	pluginUser,
	readFieldValues,
	routeRequestHeaders,
	writeFieldValues
} from './runtime';

describe('parseProfile', () => {
	const profile = {
		id: '1',
		email: 'ada@example.com',
		emailVerified: true,
		name: 'Ada',
		avatarUrl: null
	};

	it('accepts a valid profile', () => {
		expect(parseProfile(profile)).toEqual(profile);
	});

	it('rejects anything else with a PluginCallError', () => {
		expect(() => parseProfile({ ...profile, id: '' })).toThrow(PluginCallError);
		expect(() => parseProfile({ ...profile, emailVerified: 'yes' })).toThrow(/emailVerified/);
		expect(() => parseProfile(null)).toThrow(PluginCallError);
	});
});

/**
 * The OAuth settings the built-in providers had before they became plugins. Sign-ins with them
 * must keep working exactly as before.
 */
const BEFORE = {
	google: {
		authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
		tokenUrl: 'https://oauth2.googleapis.com/token',
		scopes: ['openid', 'email', 'profile'],
		pkce: true
	},
	github: {
		authorizeUrl: 'https://github.com/login/oauth/authorize',
		tokenUrl: 'https://github.com/login/oauth/access_token',
		scopes: ['read:user', 'user:email'],
		pkce: false
	},
	microsoft: {
		authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
		tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
		scopes: ['openid', 'email', 'profile', 'User.Read'],
		pkce: true
	},
	discord: {
		authorizeUrl: 'https://discord.com/oauth2/authorize',
		tokenUrl: 'https://discord.com/api/oauth2/token',
		scopes: ['identify', 'email'],
		pkce: false
	},
	twitch: {
		authorizeUrl: 'https://id.twitch.tv/oauth2/authorize',
		tokenUrl: 'https://id.twitch.tv/oauth2/token',
		scopes: ['user:read:email'],
		pkce: false
	}
};

describe('built-in sign-in providers', () => {
	it.each(Object.entries(BEFORE))('%s keeps its id and OAuth settings', async (id, config) => {
		const plugin = embeddedPlugin(`auth-${id}`)!;
		const description = await describeEmbedded(plugin);

		expect(plugin.manifest.contributes.authProviders.map((provider) => provider.id)).toEqual([id]);
		expect(description.authProviders[id]).toEqual(config);
	});
});

/** A plugin with a field type that has every hook, one without hooks, and a few routes. */
const PLUGIN: PluginDefinition = {
	fields: {
		rating: {
			validate: (value, options) =>
				typeof value === 'number' && value >= 0 && value <= Number(options.max ?? 5)
					? { valid: true }
					: { valid: false, message: `Pick 0 to ${options.max ?? 5} stars` },
			serialize: (value) => Math.round(value as number),
			deserialize: (value) => ({ stars: value })
		},
		plain: {}
	},
	routes: {
		'GET /items': () => Response.json(['a']),
		'GET /items/:id': (_request, ctx) => Response.json({ id: ctx.params.id }),
		'GET /items/new': () => Response.json('new'),
		'POST /items/:id': async (request, ctx) =>
			Response.json({ body: await request.text(), admin: ctx.admin, user: ctx.user?.id ?? null }),
		'GET /boom': () => {
			throw new Error('boom');
		},
		'GET /wrong': (() => 'text') as unknown as () => Response
	}
};

const ctx = pluginContext({ id: 'demo', version: '1.0.0' }, EMPTY_CALL_CONTEXT, fetch);

describe('dispatch of field calls', () => {
	it('validates, then serializes the values to write', async () => {
		await expect(
			dispatch(
				PLUGIN,
				{
					type: 'fields.write',
					items: [
						{ type: 'rating', name: 'stars', options: {}, value: 3.6 },
						{ type: 'rating', name: 'stars', options: { max: 10 }, value: 11 },
						{ type: 'plain', name: 'note', options: {}, value: 'as is' },
						{ type: 'unknown', name: 'other', options: {}, value: undefined }
					]
				},
				ctx
			)
		).resolves.toEqual([
			{ ok: true, value: 4 },
			{ ok: false, message: 'Pick 0 to 10 stars' },
			{ ok: true, value: 'as is' },
			{ ok: true, value: null }
		]);
	});

	it('deserializes stored values, and passes them through without a hook', async () => {
		await expect(
			dispatch(
				PLUGIN,
				{
					type: 'fields.read',
					items: [
						{ type: 'rating', values: [1, null] },
						{ type: 'plain', values: ['x'] },
						{ type: 'unknown', values: [] }
					]
				},
				ctx
			)
		).resolves.toEqual([[{ stars: 1 }, { stars: null }], ['x'], []]);
	});

	it('describes the field hooks', async () => {
		const description = describeResultSchema.parse(
			await dispatch(PLUGIN, { type: 'describe' }, ctx)
		);

		expect(description.fields).toEqual(['rating', 'plain']);
		expect(description.fieldHandlers).toEqual({
			rating: { validate: true, serialize: true, deserialize: true },
			plain: { validate: false, serialize: false, deserialize: false }
		});
		expect(
			describeResultSchema.parse({ authProviders: {}, fields: [], routes: [] }).fieldHandlers
		).toBeUndefined();
	});
});

describe('writeFieldValues and readFieldValues', () => {
	const runtime = (answer: unknown): PluginRuntime => ({
		call: async () => answer,
		route: async () => new Response()
	});
	const item = { type: 'rating', name: 'stars', options: {}, value: 1 };

	it('check that every item has an answer that fits a column', async () => {
		await expect(writeFieldValues(runtime([{ ok: true, value: 1 }]), [item])).resolves.toEqual([
			{ ok: true, value: 1 }
		]);
		await expect(writeFieldValues(runtime([]), [item])).rejects.toThrow(PluginCallError);
		await expect(writeFieldValues(runtime([{ ok: true, value: {} }]), [item])).rejects.toThrow(
			PluginCallError
		);
		await expect(
			readFieldValues(runtime([[1, 2]]), [{ type: 'rating', values: [1, 2] }])
		).resolves.toEqual([[1, 2]]);
		await expect(
			readFieldValues(runtime([[1]]), [{ type: 'rating', values: [1, 2] }])
		).rejects.toThrow(PluginCallError);
	});

	it('do not call the plugin without items', async () => {
		const unused = runtime(null);

		await expect(writeFieldValues(unused, [])).resolves.toEqual([]);
		await expect(readFieldValues(unused, [])).resolves.toEqual([]);
	});
});

describe('matchRoute', () => {
	const routes = PLUGIN.routes!;

	it('matches static paths and :param segments, static first', () => {
		expect(matchRoute(routes, 'GET', '/items')).toMatchObject({ params: {} });
		expect(matchRoute(routes, 'GET', '/items/')).toMatchObject({ params: {} });
		expect(matchRoute(routes, 'get', '/items/a%20b')).toMatchObject({ params: { id: 'a b' } });
		expect(matchRoute(routes, 'GET', '/items/new')).toMatchObject({
			handler: routes['GET /items/new'],
			params: {}
		});
	});

	it('answers 404 for unknown paths and 405 for other methods', () => {
		expect(matchRoute(routes, 'GET', '/nope')).toEqual({ status: 404 });
		expect(matchRoute(routes, 'GET', '/items/1/more')).toEqual({ status: 404 });
		expect(matchRoute(routes, 'GET', '/items/%E0%A4%A')).toEqual({ status: 404 });
		expect(matchRoute(routes, 'DELETE', '/items/1')).toEqual({
			status: 405,
			allow: ['GET', 'POST']
		});
		expect(matchRoute({ 'not a key': () => new Response() }, 'GET', '/')).toEqual({
			status: 404
		});
	});
});

describe('pluginContext settings', () => {
	const manifest = {
		id: 'demo',
		version: '1.0.0',
		settings: [
			{
				key: 'greeting',
				label: 'Greeting',
				type: 'text' as const,
				required: false,
				default: 'Hello'
			},
			{ key: 'limit', label: 'Limit', type: 'number' as const, required: false },
			{ key: 'verbose', label: 'Verbose', type: 'boolean' as const, required: false, default: true }
		]
	};

	it('parses saved values by type', async () => {
		const { settings } = pluginContext(
			manifest,
			{ settings: { greeting: 'Hi', limit: '42', verbose: 'false' } },
			fetch
		);

		expect(await settings.get('greeting')).toBe('Hi');
		expect(await settings.get('limit')).toBe(42);
		expect(await settings.get('verbose')).toBe(false);
		expect(await settings.getAll()).toEqual({ greeting: 'Hi', limit: 42, verbose: false });
	});

	it('falls back to the defaults, else null', async () => {
		const { settings } = pluginContext(
			manifest,
			{ settings: resolveSettings(manifest.settings, {}) },
			fetch
		);

		expect(await settings.getAll()).toEqual({ greeting: 'Hello', limit: null, verbose: true });
		expect(await settings.get('missing')).toBeNull();
	});

	it('has no settings without definitions', async () => {
		const { settings } = pluginContext(
			{ id: 'demo', version: '1.0.0' },
			{ settings: { greeting: 'Hi' } },
			fetch
		);

		expect(await settings.get('greeting')).toBeNull();
	});
});

describe('dispatchRoute', () => {
	const request = (path: string, init?: RequestInit) =>
		new Request(`https://pouchbase.example.com/api/plugins/demo${path}`, init);

	it('runs the handler with params, admin and user', async () => {
		const routeCtx = pluginContext({ id: 'demo', version: '1.0.0' }, EMPTY_CALL_CONTEXT, fetch, {
			admin: true,
			user: pluginUser({ id: 'u1' })
		});
		const response = await dispatchRoute(
			PLUGIN,
			request('/items/7', { method: 'POST', body: 'hi' }),
			'/items/7',
			routeCtx
		);

		await expect(response.json()).resolves.toEqual({ body: 'hi', admin: true, user: 'u1' });
	});

	it('answers 404 and 405 as JSON', async () => {
		const missing = await dispatchRoute(PLUGIN, request('/nope'), '/nope', ctx);
		const method = await dispatchRoute(PLUGIN, request('/items', { method: 'PUT' }), '/items', ctx);

		expect(missing.status).toBe(404);
		await expect(missing.json()).resolves.toEqual({ message: 'Route not found' });
		expect(method.status).toBe(405);
		expect(method.headers.get('allow')).toBe('GET');
		expect((await dispatchRoute(undefined, request('/'), '/', ctx)).status).toBe(404);
	});

	it('throws PluginCallError when the handler fails', async () => {
		await expect(dispatchRoute(PLUGIN, request('/boom'), '/boom', ctx)).rejects.toThrow(
			new PluginCallError('boom')
		);
		await expect(dispatchRoute(PLUGIN, request('/wrong'), '/wrong', ctx)).rejects.toThrow(
			'did not return a Response'
		);
	});
});

describe('routeRequestHeaders', () => {
	it('hides the cookie and the host headers from the plugin', () => {
		const headers = routeRequestHeaders(
			new Headers({
				cookie: 'session=1',
				'x-pouchbase-plugin-secret': 'spoofed',
				'x-custom': 'kept',
				authorization: 'Bearer kept'
			})
		);

		expect([...headers.keys()].sort()).toEqual(['authorization', 'x-custom']);
	});
});

describe('pluginUser', () => {
	it('keeps the auth fields and plain values, nothing else', () => {
		expect(
			pluginUser({
				id: 'u1',
				email: 'ada@example.com',
				name: '',
				verified: 1,
				avatar: 'f1',
				created_at: 1,
				nickname: 'ada',
				photo: new Uint8Array([1]),
				_internal: 'x'
			})
		).toEqual({
			id: 'u1',
			email: 'ada@example.com',
			name: null,
			verified: true,
			avatar: 'f1',
			fields: { created_at: 1, nickname: 'ada' }
		});
	});
});
