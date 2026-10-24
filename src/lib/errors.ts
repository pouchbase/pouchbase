/**
 * Reading errors in the browser and on the server alike: the body of a SvelteKit `error()` (see
 * `App.Error`), thrown by remote functions and shown on the error page.
 */

const FALLBACK = 'Something went wrong';

/** What an error says; `App.Error` without the status, which a thrown error may not have. */
export type ErrorInfo = Omit<App.Error, 'status'> & { status?: number };

/**
 * The `App.Error` of anything that was thrown: the body of an `error()` from a remote function, or
 * the message of a plain `Error`.
 */
export function describeError(error: unknown): ErrorInfo {
	// An `HttpError` (`{ status, body }`), or the `App.Error` itself once SvelteKit handled it.
	const body =
		(error as { body?: Partial<App.Error> } | null)?.body ??
		(error instanceof Error ? undefined : (error as Partial<App.Error> | null));

	if (typeof body?.message === 'string') {
		return { ...body, message: body.message || FALLBACK };
	}

	if (error instanceof Error && error.message) {
		return { message: error.message };
	}

	return { message: FALLBACK };
}

/** The message of a thrown error, e.g. for a toast. */
export function errorMessage(error: unknown): string {
	return describeError(error).message;
}

/**
 * Options for `toast.error()` that show the cause of an error under its message:
 * `toast.error(errorMessage(error), errorToast(error))`.
 */
export function errorToast(error: unknown): { description?: string } {
	const { reason } = describeError(error);

	return reason ? { description: reason } : {};
}

/** Title and explanation of the error page per HTTP status. */
const STATUSES: Record<number, { title: string; description: string }> = {
	400: {
		title: 'Invalid request',
		description: 'The request could not be processed because something in it is invalid.'
	},
	401: {
		title: 'Not logged in',
		description: 'Your session has ended. Log in again to continue.'
	},
	403: {
		title: 'Not allowed',
		description: 'You are not allowed to do this.'
	},
	404: {
		title: 'Page not found',
		description: 'This page does not exist, or what it shows was deleted or renamed.'
	},
	409: {
		title: 'Conflict',
		description: 'This cannot be done in the current state.'
	},
	413: {
		title: 'Too large',
		description: 'What you sent is larger than allowed.'
	},
	422: {
		title: 'Cannot be processed',
		description: 'The request is valid, but its content cannot be used.'
	},
	429: {
		title: 'Too many requests',
		description: 'Wait a moment and try again.'
	},
	502: {
		title: 'A service did not answer',
		description: 'Pouchbase could not reach a service it depends on, such as Cloudflare.'
	},
	503: {
		title: 'Not available',
		description: 'Pouchbase is not available right now. Try again in a moment.'
	}
};

/** Title and explanation for the error page of a status, e.g. `Page not found` for `404`. */
export function statusText(status: number): { title: string; description: string } {
	return (
		STATUSES[status] ??
		(status >= 500
			? {
					title: 'Something went wrong',
					description: 'An error occurred on the server. Try again in a moment.'
				}
			: { title: 'Something went wrong', description: 'The request could not be completed.' })
	);
}
