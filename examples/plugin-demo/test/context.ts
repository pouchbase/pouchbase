import type { PluginSettingKey, PluginUser } from '@pouchbasejs/plugin-sdk/server';
import type { FakeContextOptions, FakeResponse } from '@pouchbasejs/plugin-sdk/testing';

import { fakeContext as sdkFakeContext } from '@pouchbasejs/plugin-sdk/testing';

import plugin from '../plugin.js';
import manifest from '../pouchbase-plugin.json' with { type: 'json' };

/**
 * A `PluginContext` for the demo's tests, from `fakeContext` of `@pouchbasejs/plugin-sdk/testing`:
 * `fetch` answers from canned JSON bodies (or full `Response`s) and, like the host, refuses hosts
 * outside `permissions.network`. `settings` holds what an admin would have saved, as the strings
 * the host stores; like the host, `ctx.settings.get` parses them by the setting's type and falls
 * back to the defaults in `plugin.ts`. `pouch` (from `fakePouch`) answers `ctx.pouch`, and `user`
 * is the app user of a route request.
 */
export function fakeContext(
	responses: Record<string, FakeResponse> = {},
	settings: Partial<Record<PluginSettingKey, string>> = {},
	{ pouch, user }: { pouch?: FakeContextOptions['pouch']; user?: PluginUser } = {}
) {
	return sdkFakeContext({ manifest, plugin, responses, settings, pouch, user });
}
