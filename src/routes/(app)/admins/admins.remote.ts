import { error, invalid } from '@sveltejs/kit';

import { form, getRequestEvent, query } from '$app/server';

import { createAdminSchema } from '#lib/schemas/admins.js';
import { fail } from '#lib/server/errors.js';

function requireUser() {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		error(401, 'Not logged in');
	}

	return locals;
}

/** The admin users that can log in to Pouchbase. Password hashes are never included. */
export const getAdmins = query(async () => {
	const { services } = requireUser();

	const result = await services.users().list();

	if (result.isErr()) {
		fail(result.error);
	}

	return result.value;
});

export const createAdmin = form(createAdminSchema, async (data, issue) => {
	const { services } = requireUser();

	const result = await services.users().create({
		email: data.email,
		password: data._password
	});

	if (result.isErr()) {
		if (result.error.code === 3004) {
			invalid(issue.email('This email address is already in use'));
		}

		fail(result.error);
	}

	void getAdmins().refresh();

	return { created: true };
});
