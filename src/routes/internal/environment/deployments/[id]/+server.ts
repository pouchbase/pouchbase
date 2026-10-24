import type { RequestHandler } from './$types';

import { error, json } from '@sveltejs/kit';

import { requireDeployToken } from '#lib/server/environments.js';
import { fail } from '#lib/server/errors.js';

/** How long one request may run steps of the deployment. */
const BUDGET = 20 * 1000;

/** The status of a deployment. */
export const GET: RequestHandler = async (event) => {
	await requireDeployToken(event);

	const result = await event.locals.services.environments().deployment(event.params.id);

	if (result.isErr()) {
		fail(result.error);
	}

	if (!result.value) {
		error(404, 'Deployment not found');
	}

	return json(result.value);
};

/**
 * Runs steps of the deployment, then answers with its status. The publishing instance calls it
 * until the deployment is done; the scheduled tick continues it as well.
 */
export const POST: RequestHandler = async (event) => {
	await requireDeployToken(event);

	const environments = event.locals.services.environments();
	const advanced = await environments.advance(BUDGET);

	if (advanced.isErr()) {
		fail(advanced.error);
	}

	const result = await environments.deployment(event.params.id);

	if (result.isErr()) {
		fail(result.error);
	}

	if (!result.value) {
		error(404, 'Deployment not found');
	}

	return json(result.value);
};
