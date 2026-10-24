import { getRequestEvent, query } from '$app/server';

import { fail } from '#lib/server/errors.js';

/** Whether this instance is for development or production; `null` when it isn't set. */
export const getEnvironment = query(async () => {
	const result = await getRequestEvent().locals.services.environments().get();

	if (result.isErr()) {
		fail(result.error);
	}

	return result.value;
});
