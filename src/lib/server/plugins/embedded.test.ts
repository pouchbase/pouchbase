import { resolveSettings } from '@pouchbasejs/plugin-sdk';
import { describe, expect, it } from 'vitest';

import { embeddedPlugin, embeddedPlugins, InProcessRuntime, loadEmbeddedPlugins } from './embedded';
import { describePlugin, oauthProfileSchema } from './runtime';

describe('embeddedPlugins', () => {
	it('finds the first-party plugins in plugins/', () => {
		const ids = embeddedPlugins().map((plugin) => plugin.manifest.id);

		expect(ids).toEqual(
			expect.arrayContaining([
				'auth-discord',
				'auth-github',
				'auth-google',
				'auth-microsoft',
				'auth-twitch'
			])
		);
	});

	it('fills the manifest from package.json and bundles the icons', () => {
		const google = embeddedPlugin('auth-google')!;

		expect(google.manifest.version).toMatch(/^\d+\.\d+\.\d+/);
		expect(google.manifest.license).toBe('MIT');
		expect(google.manifest.server).toBe('server.js');
		expect(google.manifest.icon).toBe('ui/auth/google/icon.svg');
		expect(google.manifest.contributes.authProviders).toEqual([
			{
				id: 'google',
				label: 'Google',
				consoleUrl: 'https://console.cloud.google.com/apis/credentials',
				icon: 'ui/auth/google/icon.svg'
			}
		]);
		expect(google.assets['ui/auth/google/icon.svg']).toContain('<svg');
	});

	it('contributes the same provider ids and labels as before, with their icons', () => {
		const providers = embeddedPlugins().flatMap((plugin) =>
			plugin.manifest.contributes.authProviders.map((provider) => ({
				plugin: plugin.manifest.id,
				...provider
			}))
		);

		expect(providers.map(({ plugin, id, label, icon }) => ({ plugin, id, label, icon }))).toEqual(
			expect.arrayContaining(
				[
					['discord', 'Discord'],
					['github', 'GitHub'],
					['google', 'Google'],
					['microsoft', 'Microsoft'],
					['twitch', 'Twitch']
				].map(([id, label]) => ({
					plugin: `auth-${id}`,
					id,
					label,
					icon: `ui/auth/${id}/icon.svg`
				}))
			)
		);

		for (const provider of providers) {
			expect(provider.consoleUrl).toMatch(/^https:\/\//);
			expect(
				embeddedPlugin(provider.plugin)!.assets[provider.icon!],
				`${provider.plugin}: ${provider.icon}`
			).toContain('<svg');
		}
	});

	it('runs the server code in process', async () => {
		const requests: string[] = [];
		const runtime = new InProcessRuntime(embeddedPlugin('auth-google')!, {
			fetch: (async (input: RequestInfo | URL) => {
				const request = input as Request;

				requests.push(`${request.url} ${request.headers.get('authorization')}`);

				return Response.json({
					sub: '123',
					email: 'ada@example.com',
					email_verified: true,
					name: 'Ada'
				});
			}) as typeof fetch
		});

		const description = await describePlugin(runtime);

		expect(description.authProviders.google).toMatchObject({
			authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
			pkce: true
		});

		const profile = oauthProfileSchema.parse(
			await runtime.call({
				type: 'profile',
				provider: 'google',
				accessToken: 'token',
				credentials: { clientId: 'client' }
			})
		);

		expect(profile).toEqual({
			id: '123',
			email: 'ada@example.com',
			emailVerified: true,
			name: 'Ada',
			avatarUrl: null
		});
		expect(requests).toEqual(['https://openidconnect.googleapis.com/v1/userinfo Bearer token']);
	});

	it('every built-in plugin describes the providers it contributes', async () => {
		for (const plugin of embeddedPlugins()) {
			const description = await describePlugin(new InProcessRuntime(plugin));

			expect(Object.keys(description.authProviders).sort()).toEqual(
				plugin.manifest.contributes.authProviders.map((provider) => provider.id).sort()
			);
		}
	});
});

describe('loadEmbeddedPlugins', () => {
	const manifest = {
		apiVersion: 1,
		id: 'auth-example',
		name: 'Example sign-in',
		version: '1.0.0',
		description: 'Sign in with Example.',
		license: 'MIT',
		server: 'server.js',
		contributes: {
			authProviders: [{ id: 'example', label: 'Example', icon: 'ui/auth/example/icon.svg' }]
		}
	};
	const server = async () => ({ default: {} });
	const icon = { 'ui/auth/example/icon.svg': '<svg/>' };

	it('skips plugins with an invalid manifest, a duplicate id, missing server code or missing icons', () => {
		const { plugins, issues } = loadEmbeddedPlugins({
			plugins: [
				{ dir: '/plugins/b', manifest: { ...manifest, id: 'auth-b' }, assets: icon, server: null },
				{ dir: '/plugins/a', manifest, assets: icon, server },
				{ dir: '/plugins/c', manifest: { ...manifest, id: 'auth-c' }, assets: {}, server },
				{ dir: '/plugins/d', manifest: { id: 'Bad' }, assets: {}, server: null },
				{ dir: '/plugins/e', manifest, assets: icon, server }
			],
			issues: [{ dir: '/plugins/f', message: 'auth/f: has no provider.ts' }]
		});

		expect(plugins.map((plugin) => plugin.manifest.id)).toEqual(['auth-example']);
		expect(plugins[0]!.assets).toEqual(icon);
		expect(issues).toEqual([
			{ dir: '/plugins/f', message: 'auth/f: has no provider.ts' },
			{ dir: '/plugins/b', message: 'Missing server code: server.js' },
			{ dir: '/plugins/c', message: 'Missing file: ui/auth/example/icon.svg' },
			{ dir: '/plugins/d', message: expect.stringMatching(/^Invalid manifest/) },
			{ dir: '/plugins/e', message: 'Duplicate plugin id: auth-example' }
		]);
	});
});

describe('InProcessRuntime.route', () => {
	const { plugins } = loadEmbeddedPlugins({
		issues: [],
		plugins: [
			{
				dir: '/plugins/demo',
				manifest: {
					apiVersion: 1,
					id: 'demo',
					name: 'Demo',
					version: '1.0.0',
					description: 'A demo.',
					license: 'MIT',
					server: 'server.js',
					settings: [{ key: 'greeting', label: 'Greeting', default: 'Hello' }]
				},
				assets: {},
				server: async () => ({
					default: {
						routes: {
							'POST /greet/:name': async (request, ctx) =>
								Response.json({
									text: `${await ctx.settings.get('greeting')} ${ctx.params.name}`,
									body: await request.text(),
									url: request.url,
									cookie: request.headers.get('cookie'),
									admin: ctx.admin,
									user: ctx.user?.id ?? null
								})
						}
					}
				})
			}
		]
	});
	const runtime = new InProcessRuntime(plugins[0]!);
	const url = 'https://pouchbase.example.com/api/plugins/demo/greet/Ada';

	it('calls the handler directly with the original request', async () => {
		const response = await runtime.route(
			new Request(url, { method: 'POST', body: 'hi', headers: { cookie: 'session=1' } }),
			{ path: '/greet/Ada', search: '' },
			{ settings: resolveSettings(plugins[0]!.manifest.settings, {}), admin: false, user: null }
		);

		await expect(response.json()).resolves.toEqual({
			text: 'Hello Ada',
			body: 'hi',
			url,
			cookie: null,
			admin: false,
			user: null
		});
	});

	it('answers 404 and 405', async () => {
		const context = { settings: {}, admin: true, user: null };

		expect(
			(await runtime.route(new Request(url), { path: '/nope', search: '' }, context)).status
		).toBe(404);
		expect(
			(await runtime.route(new Request(url), { path: '/greet/Ada', search: '' }, context)).status
		).toBe(405);
	});
});
