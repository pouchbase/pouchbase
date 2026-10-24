import type { HandleClientError } from '@sveltejs/kit/hooks';

/** Errors in the browser (a page that fails to render, a failed import) for the error page. */
export const handleError: HandleClientError = ({ kind, error, event }) => {
	if (kind === 'framework' && error.status === 404) {
		return { message: `There is no page at ${event.url.pathname}` };
	}

	if (kind !== 'unknown') {
		return;
	}

	console.error('Unexpected error', error);

	return { message: 'An unexpected error occurred in the browser' };
};
