/**
 * The network allowlist of a plugin: `ctx.fetch` reaches only the hosts in the manifest's
 * `permissions.network`, over HTTPS. The host checks it with these functions, and so does
 * `fakeContext` from `@pouchbasejs/plugin-sdk/testing`.
 *
 * - `api.example.com` matches exactly that host.
 * - `*.example.com` matches every subdomain at any depth (`a.example.com`, `a.b.example.com`), but
 *   not `example.com` itself, the same as a wildcard certificate; list both to allow both.
 */

/** Whether `hostname` (from a URL) is allowed by one entry of `permissions.network`. */
export function hostMatches(hostname: string, pattern: string): boolean {
	const host = hostname.toLowerCase().replace(/\.$/, '');
	const entry = pattern.toLowerCase();

	if (entry.startsWith('*.')) {
		const suffix = entry.slice(1);

		return host.length > suffix.length && host.endsWith(suffix);
	}

	return host === entry;
}

/** Why `url` may not be fetched, or `null` when it may. */
export function blockedReason(url: URL, network: readonly string[]): string | null {
	if (url.protocol !== 'https:') {
		return `Only https URLs can be fetched: ${url.href}`;
	}

	if (!network.some((pattern) => hostMatches(url.hostname, pattern))) {
		return `${url.hostname} is not in permissions.network`;
	}

	return null;
}
