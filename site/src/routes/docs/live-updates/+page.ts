import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

// The docs of realtime were called "Live updates" before; keep old links working.
export const prerender = false;

export function load() {
	redirect(308, resolve('/docs/realtime'));
}
