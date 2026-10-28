import { error } from '@sveltejs/kit';

import { form, query } from '$app/server';
import { requireUser } from '#lib/server/remote.js';

import { apiKeyIdSchema, apiKeySchema } from '#lib/schemas/api-keys.js';
import { fail } from '#lib/server/errors.js';

/** Every API key, newest first; the keys of functions too. */
export const getApiKeys = query(async () => {
	const { services } = requireUser();

	const result = await services.apiKeys().list();

	if (result.isErr()) {
		fail(result.error);
	}

	return result.value;
});

/** Creates an API key and returns it; it is shown once and can't be read back. */
export const createApiKey = form(apiKeySchema, async (data) => {
	const { services } = requireUser();

	const result = await services.apiKeys().create(data.name);

	if (result.isErr()) {
		fail(result.error);
	}

	void getApiKeys().refresh();

	return { key: result.value.key };
});

export const deleteApiKey = form(apiKeyIdSchema, async (data) => {
	const { services } = requireUser();

	const result = await services.apiKeys().delete(data.id);

	if (result.isErr()) {
		if (result.error.code === 23001) {
			error(404, 'API key not found');
		}

		if (result.error.code === 23002) {
			error(409, 'The key of a function is renewed when the function is deployed');
		}

		fail(result.error);
	}

	void getApiKeys().refresh();

	return { deleted: true };
});
