import type { HandleServerError } from '@sveltejs/kit/hooks';

import { dev } from '$app/env';

import { reasonOf } from '../errors';

/**
 * Unexpected errors (a bug, an exception of a library) get a reference that is logged with the
 * error, so the error page can point to the log entry. Admins also see what went wrong. Errors of
 * `error()` and `fail()` already say what went wrong and keep their body.
 */
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind === 'framework' && error.status === 404) {
		return { message: `There is no page at ${event.url.pathname}` };
	}

	if (kind !== 'unknown') {
		return;
	}

	const id = crypto.randomUUID().slice(0, 8);

	console.error(
		`[pouchbase] Unexpected error ${id} on ${event.request.method} ${event.url.pathname}`,
		error
	);

	const reason = dev || event.locals.user ? reasonOf(error) : undefined;

	return {
		message: 'An unexpected error occurred on the server',
		id,
		...(reason && { reason })
	};
};
