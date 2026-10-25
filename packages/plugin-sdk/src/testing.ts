import type {
	PluginContext,
	PluginSettingDefinition,
	PluginSettingKey,
	PluginUser
} from './server.js';

import { blockedReason } from './network.js';
import { createPluginSettings } from './server.js';

/**
 * Helpers for testing a plugin's server code with vitest (or any test runner) in Node.js, without a
 * host: `fakeContext` builds the `ctx` that field types, auth providers and routes get.
 *
 * ```ts
 * import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
 *
 * import plugin from '../plugin.js';
 * import manifest from '../pouchbase-plugin.json' with { type: 'json' };
 * import { GET } from '../routes/status.js';
 *
 * const { ctx, requests } = fakeContext({
 * 	manifest,
 * 	plugin,
 * 	responses: { 'https://api.example.com/status': { ok: true } },
 * 	settings: { greeting: 'Hi' }
 * });
 * const response = await GET(new Request('https://pouchbase.test/api/plugins/demo/status'), ctx);
 * ```
 */

/** A request the plugin made through `ctx.fetch`. */
export type FakeRequest = { url: string; method: string; headers: Headers };

/** A call of `ctx.log`. */
export type FakeLog = { level: 'info' | 'warn' | 'error'; message: string; data?: unknown };

/**
 * A canned answer: a `Response` (cloned for every request), a function of the request that returns
 * one, or anything else as a JSON body with status 200.
 */
export type FakeResponse = unknown;

export type FakeContextOptions = {
	/**
	 * The plugin's manifest, usually `pouchbase-plugin.json` imported as JSON: `id` and `version`
	 * become `ctx.plugin`, and `ctx.fetch` reaches only the hosts in `permissions.network` (with
	 * `*.example.com` wildcards, like the host). Settings in the manifest (legacy layout) are used
	 * when `plugin` has none.
	 */
	manifest?: {
		id?: string;
		version?: string;
		permissions?: { network?: readonly string[] };
		settings?: readonly PluginSettingDefinition[];
	};
	/** The default export of `plugin.ts`, for its setting definitions. */
	plugin?: { settings?: readonly PluginSettingDefinition[] };
	/**
	 * Answers of `ctx.fetch` by URL (`https://api.example.com/user`), or by method and URL
	 * (`POST https://api.example.com/items`), which comes first. Other URLs answer `404`.
	 */
	responses?: Record<string, FakeResponse>;
	/**
	 * What an admin saved, as the strings the host stores; `ctx.settings.get` parses them by the
	 * setting's type and falls back to its `default`, like the host.
	 */
	settings?: Partial<Record<PluginSettingKey, string>>;
	/** `ctx.user`; default `null`. */
	user?: PluginUser | null;
	/** `ctx.admin`; default `false`. */
	admin?: boolean;
	/** `ctx.params` of a route; default `{}`. */
	params?: Record<string, string>;
};

export type FakeContext = {
	/** A `PluginContext` with the `params` of a route, so it fits every handler. */
	ctx: PluginContext & { params: Record<string, string> };
	/** Every request that reached `ctx.fetch`'s canned responses, in order. */
	requests: FakeRequest[];
	/** Every call of `ctx.log`, in order. */
	logs: FakeLog[];
};

/** A `PluginContext` for tests; see `FakeContextOptions`. */
export function fakeContext(options: FakeContextOptions = {}): FakeContext {
	const { manifest = {}, responses = {} } = options;
	const network = manifest.permissions?.network ?? [];
	const requests: FakeRequest[] = [];
	const logs: FakeLog[] = [];

	const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		const url = new URL(request.url);
		const reason = blockedReason(url, network);

		if (reason) {
			// What the host's `ctx.fetch` throws, too.
			throw new TypeError(reason);
		}

		requests.push({ url: url.href, method: request.method, headers: request.headers });

		const key = `${request.method} ${url.href}`;
		let answer = Object.hasOwn(responses, key)
			? responses[key]
			: Object.hasOwn(responses, url.href)
				? responses[url.href]
				: undefined;

		if (typeof answer === 'function') {
			answer = await (answer as (request: Request) => unknown)(request);
		}

		if (answer === undefined) {
			return new Response('Not found', { status: 404 });
		}

		return answer instanceof Response ? answer.clone() : Response.json(answer);
	}) as typeof globalThis.fetch;

	const logger =
		(level: FakeLog['level']) =>
		(message: string, data?: unknown): void => {
			logs.push(data === undefined ? { level, message } : { level, message, data });
		};

	const ctx: FakeContext['ctx'] = {
		plugin: { id: manifest.id ?? 'plugin', version: manifest.version ?? '0.1.0' },
		fetch,
		settings: createPluginSettings(
			options.plugin?.settings ?? manifest.settings,
			(options.settings ?? {}) as Record<string, string>
		),
		log: { info: logger('info'), warn: logger('warn'), error: logger('error') },
		admin: options.admin ?? false,
		user: options.user ?? null,
		params: options.params ?? {}
	};

	return { ctx, requests, logs };
}
