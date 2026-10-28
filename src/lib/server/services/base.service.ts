import type { RequestEvent } from '@sveltejs/kit';

import { fromPromise, type ResultAsync } from 'neverthrow';

import { getRequestEvent } from '$app/server';

import { reasonOf } from '../errors';
import { Failure, unwrap, type AnyServiceError, type ServiceError } from '../failure';
import { PlatformError } from '../platform';
import { db } from '../db';

/** The error union of a service method, e.g. `ErrorOf<ReturnType<FieldsService['create']>>`. */
export type ErrorOf<T> = T extends ResultAsync<unknown, infer E> ? E : never;

export type { AnyServiceError, ContextError, ServiceError } from '../failure';
export { Failure, unwrap } from '../failure';

export class Service {
	protected readonly ctx: RequestEvent;

	constructor() {
		this.ctx = getRequestEvent();
	}

	/**
	 * Generically format an error object
	 *
	 * @param code - Give this a unique number, to reference the error
	 * @param message - A constant for the code, e.g. `API_KEYS_QUERY_FAILED`; the message people
	 *   see is in `ERROR_MESSAGES` (`#lib/server/error-messages.ts`)
	 * @param error - The original error, if any; its message becomes the `reason`
	 * @returns
	 */
	error<Code extends number, Message extends string>(
		code: Code,
		message: Message,
		error?: unknown
	): ServiceError<Code, Message> {
		const reason = reasonOf(error);

		return {
			code,
			message,
			...(reason && { reason }),
			data:
				error instanceof PlatformError
					? { status: error.status, errors: error.errors }
					: error instanceof Error && error.cause instanceof PlatformError
						? { status: error.cause.status, errors: error.cause.errors }
						: undefined
		};
	}

	/**
	 * The body of a public method: runs `work` and turns its outcome into a `ResultAsync`. The
	 * value becomes `Ok`; a `Failure` thrown inside (by `fail()` or `must()`) becomes its service
	 * error; anything else thrown becomes `onError(error)`, usually the method's own
	 * `..._FAILED` code.
	 *
	 * ```ts
	 * list(name: string): ResultAsync<Item[], ItemsError> {
	 * 	return this.run(
	 * 		async () => {
	 * 			const { id } = await this.must(this.services.database().requireApp());
	 * 			const rows = await queryDatabase(id, `SELECT ...`);
	 *
	 * 			return rows.map(toItem);
	 * 		},
	 * 		(error) => this.error(8000, 'LIST_ITEMS_FAILED', error)
	 * 	);
	 * }
	 * ```
	 */
	protected run<T, E extends AnyServiceError>(
		work: () => Promise<T>,
		onError: (error: unknown) => E
	): ResultAsync<T, E> {
		return fromPromise(work(), (error) =>
			error instanceof Failure ? (error.error as E) : onError(error)
		);
	}

	/**
	 * Throws an expected failure inside `run()`: the method returns this error.
	 *
	 * @param code - The error code
	 * @param message - The constant for the code
	 * @param extra - `data` for the caller (e.g. validation issues) and/or the `cause` whose
	 *   message becomes the `reason`
	 */
	protected fail<Code extends number, Message extends string>(
		code: Code,
		message: Message,
		extra: { data?: unknown; cause?: unknown } = {}
	): never {
		const error = this.error(code, message, extra.cause);

		throw new Failure(extra.data === undefined ? error : { ...error, data: extra.data });
	}

	/**
	 * The value of another service's (or a private method's) result, inside `run()`; its error
	 * becomes this method's error. Include that service's codes in the method's error union.
	 */
	protected must<T>(result: ResultAsync<T, AnyServiceError>): Promise<T> {
		return unwrap(result);
	}

	/**
	 * Get the Drizzle database (the system database, through the platform driver)
	 *
	 * @returns The database instance
	 */
	protected get db() {
		return db;
	}

	/**
	 * Get the service registry, for services that build on other services
	 *
	 * @returns The services registry from the request event
	 */
	protected get services() {
		return this.ctx.locals.services;
	}
}
