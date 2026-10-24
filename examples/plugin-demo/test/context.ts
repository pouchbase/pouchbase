import type { PluginContext } from '@pouchbasejs/plugin-sdk/server';

import manifest from '../pouchbase-plugin.json' with { type: 'json' };

/**
 * A `PluginContext` for tests: `fetch` answers from canned JSON bodies (or full `Response`s) and,
 * like the host, refuses hosts outside `permissions.network`. `settings` holds what an admin would
 * have entered.
 */
export function fakeContext(
	responses: Record<string, unknown> = {},
	settings: Record<string, string> = {}
) {
	const requests: string[] = [];
	const fetch = (async (input: RequestInfo | URL) => {
		const url = new URL(input instanceof Request ? input.url : input);

		if (!manifest.permissions.network.includes(url.hostname)) {
			throw new Error(`${url.hostname} is not in permissions.network`);
		}

		requests.push(url.href);

		const response = responses[url.href];

		if (response === undefined) {
			return new Response('Not found', { status: 404 });
		}

		return response instanceof Response ? response : Response.json(response);
	}) as typeof globalThis.fetch;
	const ctx: PluginContext & { params: Record<string, string> } = {
		plugin: { id: manifest.id, version: '0.1.0' },
		fetch,
		settings: { get: async (key) => settings[key] ?? null },
		log: { info() {}, warn() {}, error() {} },
		params: {}
	};

	return { ctx, requests };
}
