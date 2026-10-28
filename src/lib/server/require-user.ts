import { error } from '@sveltejs/kit';

import { getRequestEvent } from '$app/server';

/**
 * The `locals` of the current request in a remote function, after checking that an admin is
 * signed in (`401` otherwise).
 */
export function requireUser(): App.Locals {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		error(401, 'Not logged in');
	}

	return locals;
}
