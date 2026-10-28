import type { Plan } from '#lib/environments/diff.js';
import type { Snapshot } from '#lib/schemas/environments.js';
import type { ServiceError } from '../base.service';
import type { Deployment } from './deployments';
import type { Services } from '../services';

import { deploymentSchema, remotePlanSchema, snapshotSchema } from '#lib/schemas/environments.js';

import { reasonOf } from '../../errors';
import { Failure, unwrap } from '../base.service';

/**
 * Talking to the linked instance over its `/internal/environment/*` endpoints, with the deploy
 * token stored in the settings. Every function throws a `Failure` the service returns as is.
 */

export type Remote = { url: string; token: string };

/** A request to the linked instance failed; `status` is 0 when it couldn't be reached. */
export type RemoteFailed = ServiceError<20009, 'REMOTE_REQUEST_FAILED'> & {
	data: { status: number; message: string };
};

export type RemoteNotLinked = ServiceError<20008, 'REMOTE_NOT_LINKED'>;

export function remoteFailure(status: number, message: string, cause?: unknown): Failure {
	const reason = reasonOf(cause);

	return new Failure({
		code: 20009,
		message: 'REMOTE_REQUEST_FAILED',
		...(reason && { reason }),
		data: { status, message }
	} satisfies RemoteFailed);
}

/** The linked instance with its token; a failure when none is linked. */
export async function linkedRemote(services: Services): Promise<Remote> {
	const values = await unwrap(
		services.settings().getMany(['environment_remote_url', 'environment_remote_token'])
	);

	if (!values.environment_remote_url || !values.environment_remote_token) {
		throw new Failure({ code: 20008, message: 'REMOTE_NOT_LINKED' } satisfies RemoteNotLinked);
	}

	return { url: values.environment_remote_url, token: values.environment_remote_token };
}

/** Calls an `/internal/environment/...` endpoint of another instance. */
export async function request(
	remote: Remote,
	method: 'GET' | 'POST',
	path: string,
	body?: unknown
): Promise<unknown> {
	let response: Response;

	try {
		response = await fetch(`${remote.url}${path}`, {
			method,
			headers: {
				authorization: `Bearer ${remote.token}`,
				...(body !== undefined && { 'content-type': 'application/json' })
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			redirect: 'error'
		});
	} catch (error) {
		throw remoteFailure(0, `Could not reach ${remote.url}`, error);
	}

	const json: unknown = await response.json().catch(() => null);

	if (response.ok) {
		return json;
	}

	const message = (json as { message?: unknown } | null)?.message;

	throw remoteFailure(
		response.status,
		typeof message === 'string' ? message : `${response.status} ${response.statusText}`
	);
}

/** The snapshot of the linked instance; `message` says what a wrong answer means. */
export async function fetchSnapshot(remote: Remote, message: string): Promise<Snapshot> {
	const parsed = snapshotSchema.safeParse(
		await request(remote, 'GET', '/internal/environment/snapshot')
	);

	if (!parsed.success) {
		throw remoteFailure(0, message);
	}

	return parsed.data;
}

/** Asks the linked instance what publishing `source` to it would change. */
export async function fetchPlan(remote: Remote, source: Snapshot) {
	const parsed = remotePlanSchema.safeParse(
		await request(remote, 'POST', '/internal/environment/plan', source)
	);

	if (!parsed.success) {
		throw remoteFailure(0, 'Unexpected response');
	}

	return {
		plan: parsed.data.plan as Plan,
		targetHash: parsed.data.targetHash,
		environment: parsed.data.target.environment
	};
}

/** A deployment as the linked instance reports it. */
export function parseDeployment(body: unknown): Deployment {
	const parsed = deploymentSchema.safeParse(body);

	if (!parsed.success) {
		throw remoteFailure(0, 'Unexpected response');
	}

	return parsed.data as Deployment;
}
