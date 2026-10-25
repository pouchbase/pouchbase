import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * Matching a request to the `routes` of a plugin's server code (`ServerDefinition`): keys are
 * `"<METHOD> /<path>"`, e.g. `"GET /items/:id"`, where a `:name` segment matches any one segment
 * and ends up in `ctx.params`. Mirrored in the Worker's entry code (`worker.ts`); keep both in step.
 *
 * - Paths are compared segment by segment; a trailing slash is ignored (`/items/` is `/items`).
 * - A static segment wins over a `:param` segment at the same position, so `GET /items/new` is
 *   picked over `GET /items/:id` for `/items/new`.
 * - A path that matches with another method answers 405 (with the methods it has in `allow`),
 *   one that matches nothing 404. Keys that aren't `"<METHOD> /<path>"` are ignored.
 */

export type RouteMatch =
	| { handler: RouteHandler; params: Record<string, string> }
	| { status: 404 }
	| { status: 405; allow: string[] };

const ROUTE_KEY = /^(GET|POST|PUT|PATCH|DELETE) (\/\S*)$/;

/** Splits `/items/42/` into `['items', '42']`; `/` into `[]`. */
function splitPath(path: string): string[] {
	const parts = path.split('/').slice(1);

	if (parts.length && parts[parts.length - 1] === '') {
		parts.pop();
	}

	return parts;
}

/** The params when `pattern` matches `parts`, or `null`. */
function matchSegments(pattern: string[], parts: string[]): Record<string, string> | null {
	if (pattern.length !== parts.length) {
		return null;
	}

	const params: Record<string, string> = {};

	for (let index = 0; index < pattern.length; index++) {
		const segment = pattern[index]!;
		const part = parts[index]!;

		if (segment.startsWith(':') && segment.length > 1) {
			if (part === '') {
				return null;
			}

			try {
				params[segment.slice(1)] = decodeURIComponent(part);
			} catch {
				return null;
			}
		} else if (segment !== part) {
			return null;
		}
	}

	return params;
}

/** Negative when `a` is more specific than `b`: the first static segment where the other has a param. */
function compareSpecificity(a: string[], b: string[]) {
	for (let index = 0; index < a.length; index++) {
		const left = a[index]!.startsWith(':');
		const right = b[index]!.startsWith(':');

		if (left !== right) {
			return left ? 1 : -1;
		}
	}

	return 0;
}

/** Finds the handler for `method` and `pathname` (the path below the plugin, e.g. `/items/42`). */
export function matchRoute(
	routes: Record<string, RouteHandler | undefined>,
	method: string,
	pathname: string
): RouteMatch {
	const parts = splitPath(pathname);
	let best: { pattern: string[]; handler: RouteHandler; params: Record<string, string> } | null =
		null;
	const allow = new Set<string>();

	for (const [key, handler] of Object.entries(routes)) {
		const parsed = ROUTE_KEY.exec(key);

		if (!parsed || typeof handler !== 'function') {
			continue;
		}

		const pattern = splitPath(parsed[2]!);
		const params = matchSegments(pattern, parts);

		if (!params) {
			continue;
		}

		allow.add(parsed[1]!);

		if (parsed[1] !== method.toUpperCase()) {
			continue;
		}

		if (!best || compareSpecificity(pattern, best.pattern) < 0) {
			best = { pattern, handler, params };
		}
	}

	if (best) {
		return { handler: best.handler, params: best.params };
	}

	return allow.size ? { status: 405, allow: [...allow].sort() } : { status: 404 };
}
