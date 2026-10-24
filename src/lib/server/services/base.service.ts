import type { RequestEvent } from '@sveltejs/kit';
import type { ResultAsync } from 'neverthrow';

import { getRequestEvent } from '$app/server';

import { reasonOf } from '../errors';
import { PlatformError } from '../platform';
import { db } from '../db';

/** The error union of a service method, e.g. `ErrorOf<ReturnType<FieldsService['create']>>`. */
export type ErrorOf<T> = T extends ResultAsync<unknown, infer E> ? E : never;

export type ServiceError<Code extends number, Message extends string> = {
	code: Code;
	message: Message;
	data?: unknown;
	/**
	 * What went wrong underneath, e.g. the message of D1 or the Cloudflare API. `fail()` shows it
	 * to admins next to the message of the code.
	 */
	reason?: string;
};

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
