import { EXAMPLE_PROVIDER_HOST } from './entries.js';
import { quote } from './source.js';

/** The `auth-provider` template: an OpenID Connect provider; see `providerEntry`. */

/** The test of the `auth-provider` template: the profile from the userinfo endpoint. */
export function providerTest(id: string) {
	return `import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import plugin from '../plugin.js';
import manifest from '../pouchbase-plugin.json' with { type: 'json' };

const USERINFO = 'https://${EXAMPLE_PROVIDER_HOST}/oauth/userinfo';
const provider = plugin.authProviders[${quote(id)}];

describe('the ${id} provider', () => {
	it('maps the userinfo claims to a profile', async () => {
		// ctx.fetch answers from these responses, and only reaches the hosts in permissions.network.
		const { ctx, requests } = fakeContext({
			manifest,
			responses: {
				[USERINFO]: { sub: '42', email: 'ada@example.com', email_verified: true, name: 'Ada' }
			}
		});

		expect(await provider.profile('token', { clientId: 'client' }, ctx)).toEqual({
			id: '42',
			email: 'ada@example.com',
			emailVerified: true,
			name: 'Ada',
			avatarUrl: null
		});
		expect(requests.map((request) => request.url)).toEqual([USERINFO]);
		expect(requests[0]?.headers.get('authorization')).toBe('Bearer token');
	});
});
`;
}
