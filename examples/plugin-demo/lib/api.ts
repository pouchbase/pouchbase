import type { PluginApi } from '@pouchbasejs/plugin-sdk/ui';

/**
 * Calls a route of the plugin with `api.fetch` (which sends the admin's session) and returns its
 * JSON; throws the route's `error` message on an answer that isn't 2xx.
 */
export async function getJson<T>(api: PluginApi, path: `/${string}`, init?: RequestInit) {
	const response = await api.fetch(path, init);
	const body = await response.json().catch(() => null);

	if (!response.ok) {
		throw new Error(body?.error ?? `The route answered ${response.status}`);
	}

	return body as T;
}

export type Info = {
	id: string;
	version: string;
	greeting: string;
	settings: { greeting: string; max_length: number; shout: boolean };
	admin: boolean;
};

export type GitHubStatus = {
	indicator: 'none' | 'minor' | 'major' | 'critical';
	description: string;
};
