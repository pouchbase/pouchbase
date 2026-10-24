import { error } from '@sveltejs/kit';

import { form, getRequestEvent, query } from '$app/server';
import { fail } from '#lib/server/errors.js';

function requireUser() {
	const event = getRequestEvent();

	if (!event.locals.user) {
		error(401, 'Not logged in');
	}

	return event;
}

/** The TypeScript types of every collection, and the token of `GET /api/types`. */
export const getTypes = query(async () => {
	const { locals } = requireUser();

	const [code, token] = await Promise.all([
		locals.services.types().generate(),
		locals.services.types().token()
	]);

	if (code.isErr()) {
		fail(code.error);
	}

	if (token.isErr()) {
		fail(token.error);
	}

	return { code: code.value, token: token.value };
});

export const regenerateTypesToken = form(async () => {
	const { locals } = requireUser();

	const result = await locals.services.types().regenerateToken();

	if (result.isErr()) {
		fail(result.error);
	}

	void getTypes().refresh();

	return { regenerated: true };
});
