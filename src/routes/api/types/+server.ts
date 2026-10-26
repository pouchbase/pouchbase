import type { RequestHandler } from './$types';

import { bearerToken, json, preflight, requestServiceKey, text } from '#lib/server/api.js';
import { API_KEY_PREFIX } from '#lib/server/services/api-keys.service.js';

/**
 * TypeScript types of every collection, for the SDK's `pouchbase types` command and
 * `pouch.schema.types()`. It takes the token shown on the API types page in the admin
 * (`?token=…` or `Authorization: Bearer <token>`), or an API key with the `service` scope
 * (`Authorization: Bearer pbk_…`).
 */
export const GET: RequestHandler = async (event) => {
	const { locals, url } = event;
	const bearer = bearerToken(event);

	if (bearer?.startsWith(API_KEY_PREFIX)) {
		const auth = await requestServiceKey(event, 'download the types');

		if ('response' in auth) {
			return auth.response;
		}
	} else {
		const token = url.searchParams.get('token') || bearer;

		if (!token) {
			return json({ message: 'Missing token' }, 401);
		}

		const verified = await locals.services.types().verifyToken(token);

		if (verified.isErr()) {
			return json({ message: 'Could not check the token' }, 500);
		}

		if (!verified.value) {
			return json({ message: 'Invalid token' }, 401);
		}
	}

	const result = await locals.services.types().generate();

	if (result.isErr()) {
		return json({ message: 'Could not generate the types' }, 500);
	}

	return text(result.value);
};

export const OPTIONS: RequestHandler = preflight;
