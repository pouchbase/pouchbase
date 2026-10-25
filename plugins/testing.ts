import type { PluginSettingDefinition } from '@pouchbasejs/plugin-sdk/server';
import type { FakeResponse } from '@pouchbasejs/plugin-sdk/testing';

import { fakeContext as sdkFakeContext } from '@pouchbasejs/plugin-sdk/testing';

/**
 * Test helpers for the plugins in this directory, on `fakeContext` of
 * `@pouchbasejs/plugin-sdk/testing`: a `PluginContext` whose `fetch` answers from canned responses
 * and, like the host, only reaches the hosts in `permissions.network`. Its `ctx.settings` is built
 * like the host's: `settings` holds the saved values as strings, parsed by the plugin's setting
 * definitions (`definePlugin({ settings })` in its `plugin.ts`, if any).
 */

export type { FakeRequest, FakeResponse } from '@pouchbasejs/plugin-sdk/testing';

export function fakeContext(
	manifest: {
		id: string;
		permissions: { network: string[] };
		settings?: readonly PluginSettingDefinition[];
	},
	responses: Record<string, FakeResponse>,
	settings: Record<string, string> = {}
) {
	return sdkFakeContext({ manifest: { version: '1.0.0', ...manifest }, responses, settings });
}

/** The headers every profile request sends, as `fetchJson` sets them. */
export function expectedHeaders(accessToken: string) {
	return {
		authorization: `Bearer ${accessToken}`,
		accept: 'application/json',
		'user-agent': 'Pouchbase'
	};
}
