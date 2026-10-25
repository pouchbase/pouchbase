import { describe, expect, expectTypeOf, it } from 'vitest';

import { blockedReason, hostMatches } from '../src/network.js';
import { definePlugin, type PluginContext } from '../src/server.js';
import { fakeContext } from '../src/testing.js';

describe('hostMatches', () => {
	it('matches exact hosts and wildcard subdomains, not the bare domain', () => {
		expect(hostMatches('API.example.com.', 'api.example.com')).toBe(true);
		expect(hostMatches('a.b.example.com', '*.example.com')).toBe(true);
		expect(hostMatches('example.com', '*.example.com')).toBe(false);
		expect(hostMatches('evilexample.com', '*.example.com')).toBe(false);
	});

	it('only allows https', () => {
		expect(blockedReason(new URL('http://api.example.com'), ['api.example.com'])).toBe(
			'Only https URLs can be fetched: http://api.example.com/'
		);
		expect(blockedReason(new URL('https://api.example.com'), ['api.example.com'])).toBeNull();
	});
});

describe('fakeContext', () => {
	const manifest = {
		id: 'acme',
		version: '1.2.3',
		permissions: { network: ['api.example.com', '*.cdn.example.com'] }
	};

	it('builds a full PluginContext with route params', () => {
		const { ctx } = fakeContext({ manifest, admin: true, params: { id: '7' } });

		expectTypeOf(ctx).toExtend<PluginContext>();
		expect(ctx.plugin).toEqual({ id: 'acme', version: '1.2.3' });
		expect(ctx.admin).toBe(true);
		expect(ctx.user).toBeNull();
		expect(ctx.params).toEqual({ id: '7' });
		expect(fakeContext().ctx.plugin).toEqual({ id: 'plugin', version: '0.1.0' });
	});

	it('answers from canned responses and records the requests', async () => {
		const { ctx, requests } = fakeContext({
			manifest,
			responses: {
				'https://api.example.com/user': { id: 1 },
				'POST https://api.example.com/items': new Response('created', { status: 201 }),
				'https://img.cdn.example.com/a.png': (request: Request) =>
					new Response(request.headers.get('accept'))
			}
		});

		expect(await (await ctx.fetch('https://api.example.com/user')).json()).toEqual({ id: 1 });

		for (let i = 0; i < 2; i++) {
			const response = await ctx.fetch('https://api.example.com/items', { method: 'POST' });

			expect([response.status, await response.text()]).toEqual([201, 'created']);
		}

		expect(
			await (
				await ctx.fetch('https://img.cdn.example.com/a.png', { headers: { Accept: 'image/png' } })
			).text()
		).toBe('image/png');
		expect((await ctx.fetch('https://api.example.com/missing')).status).toBe(404);
		expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
			'GET https://api.example.com/user',
			'POST https://api.example.com/items',
			'POST https://api.example.com/items',
			'GET https://img.cdn.example.com/a.png',
			'GET https://api.example.com/missing'
		]);
		expect(requests[3]?.headers.get('accept')).toBe('image/png');
	});

	it('refuses hosts outside permissions.network and plain http, like the host', async () => {
		const { ctx, requests } = fakeContext({ manifest });

		await expect(ctx.fetch('https://cdn.example.com/')).rejects.toThrow(
			'cdn.example.com is not in permissions.network'
		);
		await expect(ctx.fetch('http://api.example.com/')).rejects.toThrow(
			'Only https URLs can be fetched'
		);
		expect(requests).toEqual([]);
	});

	it('parses the saved settings by the plugin definitions', async () => {
		const plugin = definePlugin({
			settings: [
				{ key: 'limit', label: 'Limit', type: 'number', default: 10 },
				{ key: 'token', label: 'Token', type: 'secret', required: true }
			]
		});
		const { ctx } = fakeContext({ plugin, settings: { limit: '42' } });

		expect(await ctx.settings.getAll()).toEqual({ limit: 42, token: null });
	});

	it('records the log calls', () => {
		const { ctx, logs } = fakeContext();

		ctx.log.info('started');
		ctx.log.error('failed', { status: 500 });

		expect(logs).toEqual([
			{ level: 'info', message: 'started' },
			{ level: 'error', message: 'failed', data: { status: 500 } }
		]);
	});
});
