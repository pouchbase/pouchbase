import type { PluginApi } from '@pouchbasejs/plugin-sdk/ui';

/** A route's error answer, `{ message, errors? }`, with the messages per field. */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly errors: Record<string, string> = {}
	) {
		super(message);
	}
}

/**
 * Calls a route of the plugin with `api.fetch` (which sends the admin's session) and returns its
 * JSON; throws an `ApiError` on an answer that isn't 2xx.
 */
export async function request<T>(
	api: PluginApi,
	path: `/${string}`,
	{ method = 'GET', body }: { method?: string; body?: unknown } = {}
) {
	const response = await api.fetch(path, {
		method,
		headers: body === undefined ? undefined : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});

	if (response.status === 204) {
		return undefined as T;
	}

	const json = await response.json().catch(() => null);

	if (!response.ok) {
		throw new ApiError(json?.message ?? `The route answered ${response.status}`, response.status, {
			...json?.errors
		});
	}

	return json as T;
}

/** The dashboard path of a page of the plugin. */
export function pageHref(path = '') {
	return `/plugins/cms/posts${path ? `/${path}` : ''}`;
}

/** `2026/10/26 at 9:41 am`, the way WordPress dates posts in its list. */
export function formatDate(iso: string) {
	const date = new Date(iso);
	const day = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
	const time = date
		.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
		.toLowerCase();

	return `${day} at ${time}`;
}
