import type { HandleServerError } from '@sveltejs/kit/hooks';

/**
 * Unexpected errors get a reference that is logged with the error, so the error page can point to
 * the log entry without showing internals. Errors of `error()` keep their body.
 */
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind === 'framework' && error.status === 404) {
		return { message: `There is no page at ${event.url.pathname}` };
	}

	if (kind !== 'unknown') {
		return;
	}

	const id = crypto.randomUUID().slice(0, 8);

	console.error(`Unexpected error ${id} on ${event.request.method} ${event.url.pathname}`, error);

	return { message: 'An unexpected error occurred on our side', id };
};
