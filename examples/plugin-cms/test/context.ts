import type { PluginUser } from '@pouchbasejs/plugin-sdk/server';
import type { FakeContextOptions } from '@pouchbasejs/plugin-sdk/testing';

import { fakeContext as sdkFakeContext } from '@pouchbasejs/plugin-sdk/testing';

import plugin from '../plugin.js';
import manifest from '../pouchbase-plugin.json' with { type: 'json' };

/**
 * A `PluginContext` for the CMS's tests, from `fakeContext` of `@pouchbasejs/plugin-sdk/testing`:
 * `pouch` (from `fakePouch`) answers `ctx.pouch`, `admin` says whether an admin of the dashboard
 * calls, and `settings` holds what an admin saved, as the strings the host stores.
 */
export function fakeContext({
	pouch,
	admin = true,
	user,
	params,
	settings
}: {
	pouch?: FakeContextOptions['pouch'];
	admin?: boolean;
	user?: PluginUser;
	params?: Record<string, string>;
	settings?: { site_url?: string };
} = {}) {
	return sdkFakeContext({ manifest, plugin, pouch, admin, user, params, settings });
}
