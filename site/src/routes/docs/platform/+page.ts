import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

// A tab of the docs has no index of its own; start with its first page.
export function load() {
	redirect(307, resolve('/docs/platform/getting-started'));
}
