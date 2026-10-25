/**
 * The network allowlist of a plugin: `ctx.fetch` reaches only the hosts in the manifest's
 * `permissions.network`, over HTTPS. The Worker of an installed plugin has the same rules in its
 * entry code (`worker.ts`); keep both in step.
 *
 * - `api.example.com` matches exactly that host.
 * - `*.example.com` matches every subdomain at any depth (`a.example.com`, `a.b.example.com`), but
 *   not `example.com` itself, the same as a wildcard certificate; list both to allow both.
 *
 * The matching itself is the plugin SDK's (`hostMatches`, `blockedReason`), which its `fakeContext`
 * for tests uses too.
 */

import { blockedReason } from '@pouchbasejs/plugin-sdk';

export { blockedReason, hostMatches } from '@pouchbasejs/plugin-sdk';

/**
 * `fetch` limited to the hosts in `network`. Redirects are not followed: the plugin gets the
 * redirect response and can fetch its `Location` again, which is checked like any other URL.
 */
export function restrictedFetch(
	network: readonly string[],
	upstream: typeof fetch = fetch
): typeof fetch {
	return (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		const reason = blockedReason(new URL(request.url), network);

		if (reason) {
			throw new TypeError(reason);
		}

		return upstream(new Request(request, { redirect: 'manual' }));
	}) as typeof fetch;
}
