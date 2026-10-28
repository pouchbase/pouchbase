import type { ResultAsync } from 'neverthrow';

/**
 * The errors services return, and the `Failure` that carries one through a `throw`. Free of
 * SvelteKit imports, so pure modules and their tests can use them (the services re-export them
 * from `./services/base.service`).
 */

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

export type AnyServiceError = ServiceError<number, string>;

/** The errors a method can return that come from loading the app database and the settings. */
export type ContextError =
	ServiceError<1004, 'APP_DATABASE_MISSING'> | ServiceError<5000, 'GET_SETTING_FAILED'>;

/**
 * An expected failure inside `Service.run()`: thrown by a helper, it becomes the `Err` of the
 * method. Throw it through `this.fail(...)` or `this.must(...)`, or directly from a helper module.
 */
export class Failure extends Error {
	constructor(readonly error: AnyServiceError) {
		super(error.message);
	}
}

/**
 * The value of a service's result, for helper modules outside a service; its error becomes the
 * `Failure` that `Service.run()` returns. Inside a service, use `this.must()`.
 */
export async function unwrap<T>(result: ResultAsync<T, AnyServiceError>): Promise<T> {
	const settled = await result;

	if (settled.isErr()) {
		throw new Failure(settled.error);
	}

	return settled.value;
}
