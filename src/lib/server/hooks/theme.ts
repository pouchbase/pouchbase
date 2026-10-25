import type { Handle } from '@sveltejs/kit/hooks';

import { parseTheme, THEME_COOKIE } from '../../theme.svelte';

/** Renders the admin's colour scheme on <html>, so dark mode doesn't flash in after loading. */
export const theme: Handle = ({ event, resolve }) => {
	const value = parseTheme(event.cookies.get(THEME_COOKIE));

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%pouchbase.theme%', value === 'system' ? '' : value)
	});
};
