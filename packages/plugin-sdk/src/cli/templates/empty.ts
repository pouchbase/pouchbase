/** The `empty` template: only the manifest, an icon and a test. */

/** The test of the `empty` template: a start, with the network rules of `ctx.fetch`. */
export function emptyTest(pluginId: string) {
	return `import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import manifest from '../pouchbase-plugin.json' with { type: 'json' };

describe('${pluginId}', () => {
	it('only reaches the hosts in permissions.network', async () => {
		const { ctx } = fakeContext({ manifest });

		await expect(ctx.fetch('https://example.com/')).rejects.toThrow(
			'example.com is not in permissions.network'
		);
	});
});
`;
}
