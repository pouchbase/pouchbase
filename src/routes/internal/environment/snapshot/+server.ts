import type { RequestHandler } from './$types';

import { json } from '@sveltejs/kit';

import { requireDeployToken } from '#lib/server/environments.js';
import { fail } from '#lib/server/errors.js';

/** The snapshot of this instance, for another instance that pulls from it or plans a publish. */
export const GET: RequestHandler = async (event) => {
	await requireDeployToken(event);

	const result = await event.locals.services.environments().snapshot();

	if (result.isErr()) {
		console.error('[environments] snapshot failed', result.error);
		fail(result.error);
	}

	return json(result.value);
};
