import type { ServiceError } from './services/base.service';

import { error } from '@sveltejs/kit';

import { dev } from '$app/env';
import { getRequestEvent } from '$app/server';

import { ERROR_MESSAGES } from './error-messages';

type AnyServiceError = ServiceError<number, string>;

/**
 * What went wrong underneath an error, for the `reason` of a service error: the message of the
 * innermost cause (D1, the Cloudflare API, a plugin), or the message and reason of a service error
 * that one service passed on to another.
 */
export function reasonOf(cause: unknown): string | undefined {
	if (typeof cause === 'string') {
		return cause || undefined;
	}

	if (isServiceError(cause)) {
		const reason = serviceReason(cause);

		return reason ? `${messageOf(cause)}: ${reason}` : messageOf(cause);
	}

	if (!(cause instanceof Error)) {
		return undefined;
	}

	// Drizzle wraps the error of the driver in "Failed query: <sql>"; the driver's message says more.
	let innermost = cause;

	while (innermost.cause instanceof Error) {
		innermost = innermost.cause;
	}

	return innermost.message || cause.message || undefined;
}

/** The message of a service error for people, e.g. `Could not load the API keys`. */
export function messageOf(failure: AnyServiceError): string {
	const entry = ERROR_MESSAGES[failure.code];

	if (entry) {
		return typeof entry === 'string' ? entry : entry[1];
	}

	// An unknown code still reads better as a sentence: `LIST_FOO_FAILED` → `List foo failed`.
	const words = failure.message.toLowerCase().replaceAll('_', ' ');

	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The HTTP status that fits a service error: `404` for "not found", `409` for conflicts, ... */
export function statusOf(failure: AnyServiceError): number {
	const entry = ERROR_MESSAGES[failure.code];

	return Array.isArray(entry) ? entry[0] : 500;
}

/**
 * Throws a service error as a SvelteKit error, with a message people understand, its code and,
 * for admins, what went wrong underneath. The error page and form toasts show all of them, so use
 * this for every service error a remote function, load or endpoint doesn't handle itself:
 *
 * ```ts
 * if (result.isErr()) {
 * 	fail(result.error);
 * }
 * ```
 *
 * @param failure - The service error
 * @param status - The HTTP status; by default the one that fits the code (see `ERROR_MESSAGES`)
 */
export function fail(failure: AnyServiceError, status = statusOf(failure)): never {
	const reason = serviceReason(failure);

	if (status >= 500) {
		console.error(`[pouchbase] ${failure.code} ${failure.message}`, reason ?? '');
	}

	error(status, messageOf(failure), {
		code: failure.code,
		...(reason && mayReadReasons() && { reason })
	});
}

/**
 * Whether the request may see the causes of errors: admins, and everyone during development.
 * Visitors of public pages (an app user resetting their password) only get the message.
 */
export function mayReadReasons(): boolean {
	return dev || Boolean(getRequestEvent().locals.user);
}

function serviceReason(failure: AnyServiceError): string | undefined {
	if (failure.reason) {
		return failure.reason;
	}

	const data = failure.data as { reason?: unknown } | undefined;

	return typeof data?.reason === 'string' ? data.reason : undefined;
}

function isServiceError(value: unknown): value is AnyServiceError {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as AnyServiceError).code === 'number' &&
		typeof (value as AnyServiceError).message === 'string' &&
		!(value instanceof Error)
	);
}
