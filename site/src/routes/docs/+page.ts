import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

// The docs have no index of their own yet; start with the first page of the platform docs.
export function load() {
	redirect(307, resolve('/docs/platform/getting-started'));
}
