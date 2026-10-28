/** `items`, `v2`, `status.json`: a static route segment. */
const ROUTE_SEGMENT = /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/;

/** `:id`: a route param. */
const ROUTE_PARAM = /^:[A-Za-z_][A-Za-z0-9_]*$/;

/** First segments of a route path that the host serves itself. */
const RESERVED_ROUTE_SEGMENTS = ['assets', 'modules'];

/** Why `name` can't be an id, when it has capitals: the most common mistake. */
export function lowercaseHint(name: string) {
	return /[A-Z]/.test(name) ? 'use lowercase names' : null;
}

/**
 * Why `path` can't be the path of a route (a key of `routes`, e.g. `/items/:id`), or `null` when it
 * can.
 */
export function routePathProblem(path: string): string | null {
	if (!path.startsWith('/')) {
		return `starts with a slash, e.g. /${path}`;
	}

	if (path === '/') {
		return null;
	}

	const segments = path.slice(1).split('/');

	for (const segment of segments) {
		if (!segment) {
			return 'has an empty segment; remove the extra or trailing slash';
		}

		if (/^\[.+\]$/.test(segment)) {
			return `"${segment}" is written :${segment.slice(1, -1)} for a parameter`;
		}

		if (!ROUTE_PARAM.test(segment) && !ROUTE_SEGMENT.test(segment)) {
			return (
				lowercaseHint(segment) ??
				`"${segment}" can't be part of a route path; use lowercase words separated by dashes, or :name for a parameter`
			);
		}
	}

	if (segments[0] && RESERVED_ROUTE_SEGMENTS.includes(segments[0])) {
		return `/${segments[0]} is served by Pouchbase itself (${RESERVED_ROUTE_SEGMENTS.map((segment) => `/${segment}`).join(', ')}); use another path`;
	}

	return null;
}

/** `items/[id]`, `/items/:id` → `/items/:id`: the route path `add route` takes. */
export function routePathFor(id: string): string {
	const segments = id
		.trim()
		.split('/')
		.filter(Boolean)
		.map((segment) => segment.replace(/^\[(.+)\]$/, ':$1'));

	return `/${segments.join('/')}`;
}

/**
 * The file `add route` creates for a route path: `/` → `routes/index.ts`, `/items/:id` →
 * `routes/items/[id].ts`; `null` when the path can't be a route.
 */
export function routeFileFor(path: string): string | null {
	const route = routePathFor(path);

	if (routePathProblem(route) !== null) {
		return null;
	}

	const segments = route
		.split('/')
		.filter(Boolean)
		.map((segment) => (segment.startsWith(':') ? `[${segment.slice(1)}]` : segment));

	return `routes/${segments.length ? segments.join('/') : 'index'}.ts`;
}
