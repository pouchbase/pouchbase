import type { PageContribution } from '@pouchbasejs/plugin-sdk';

/**
 * Pieces of the HTTP side of plugins that don't need a request: who counts as an admin on a
 * plugin route, the headers of its responses and which page a dashboard URL opens.
 */

/** CORS headers of a plugin route; like functions, any origin may call it (without cookies). */
export const ROUTE_CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
	'Access-Control-Expose-Headers': '*',
	'Access-Control-Max-Age': '600'
};

/**
 * Whether a request comes from the dashboard itself (or was typed into the address bar): browsers
 * send `Sec-Fetch-Site: same-origin` or `none` then. Together with the admin's session cookie
 * this is `ctx.admin`; a page on another site can't make a request count as the admin's.
 */
export function isSameOriginRequest(headers: Headers) {
	const site = headers.get('sec-fetch-site');

	return site === 'same-origin' || site === 'none';
}

/**
 * A plugin route's response as Pouchbase serves it: with the CORS headers (unless the plugin set
 * its own), sandboxed (HTML from a plugin runs no scripts on the admin's origin) and never sniffed.
 */
export function deliverRouteResponse(response: Response) {
	const headers = new Headers(response.headers);

	for (const [name, value] of Object.entries(ROUTE_CORS_HEADERS)) {
		if (!headers.has(name)) {
			headers.set(name, value);
		}
	}

	headers.set('Content-Security-Policy', 'sandbox');
	headers.set('X-Content-Type-Options', 'nosniff');

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

/**
 * The page of `pages` that `path` (below `/plugins/<id>`, e.g. `reports/2026/10`) opens: the one
 * with the longest path that `path` is or starts with, and the rest of `path` (`2026/10`), or
 * `null` when no page matches.
 */
export function matchPage<T extends Pick<PageContribution, 'path'>>(
	pages: readonly T[],
	path: string
): { page: T; params: string } | null {
	const normalised = path.split('/').filter(Boolean).join('/');
	let best: T | null = null;

	for (const page of pages) {
		if (normalised !== page.path && !normalised.startsWith(`${page.path}/`)) {
			continue;
		}

		if (!best || page.path.length > best.path.length) {
			best = page;
		}
	}

	return best ? { page: best, params: normalised.slice(best.path.length + 1) } : null;
}
