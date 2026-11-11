import type { QueryResult, Statement } from '../types';

import { dev } from '$app/env';
import { CLOUDFLARE_API_TOKEN, POUCHBASE_INSTANCE } from '$app/env/private';

import { PlatformError } from '../types';
import { workerEnv } from '../runtime';
import { cloudflareFetch, failure } from './api';
import { bindingName } from './bindings';
import { functions } from './functions';
import {
	GATEWAY_HEADER,
	GATEWAY_MODULE,
	GATEWAY_SOURCE,
	GATEWAY_VERSION,
	NO_BINDING,
	UNAUTHORIZED
} from './gateway-worker';

/**
 * The D1 gateway of a Node instance (Docker, the binary, `node server.mjs`). A Node process can't
 * have D1 bindings, and the REST API is slow and rate limited, so the instance deploys a small
 * Worker (`<instance>-gateway`, code in `./gateway-worker`) with bindings for its databases and
 * sends its queries there, over the Worker's workers.dev URL. Until the gateway answers, and for
 * databases it has no binding for, queries keep going through the REST API.
 *
 * The token is derived from the Cloudflare API token, like the tick token, so it needs no storage:
 * a new API token gives a new gateway token, the gateway answers 401 and is deployed again.
 */

export const GATEWAY_NAME = `${POUCHBASE_INSTANCE}-gateway`;

/** Compatibility date of the gateway; raise it together with the app's. */
const COMPATIBILITY_DATE = '2026-10-20';

/** How often, and how far apart, a new deploy is checked before its URL serves it. */
const PROBE_ATTEMPTS = 15;
const PROBE_INTERVAL = 2000;

/** How long to wait before trying again after setting up the gateway failed. */
const RETRY_AFTER = 5 * 60 * 1000;

interface Gateway {
	url: string;
	token: string;
	databases: Set<string>;
}

interface ScriptBinding {
	type: string;
	name: string;
	id?: string;
	text?: string;
}

/** The gateway in use, once it answered; `null` while queries go through the REST API. */
let gateway: Gateway | null = null;
let pending: Promise<void> | null = null;
let retryAt = 0;

async function gatewayToken() {
	const data = new TextEncoder().encode(`pouchbase-gateway:${CLOUDFLARE_API_TOKEN}`);
	const digest = await crypto.subtle.digest('SHA-256', data);

	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A Node process outside `vite dev`; a Worker has its own bindings (see `./bindings`). */
function enabled() {
	return !dev && !workerEnv();
}

const settingsPath = `/workers/scripts/${encodeURIComponent(GATEWAY_NAME)}/settings`;

/** The bindings of the deployed gateway, or `null` when there is none. */
async function deployedBindings(): Promise<ScriptBinding[] | null> {
	const response = await cloudflareFetch(settingsPath);

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw await failure(response);
	}

	const { result } = (await response.json()) as { result: { bindings?: ScriptBinding[] } };

	return result.bindings ?? [];
}

/** Whether the deployed gateway runs this version with bindings for all of these databases. */
function upToDate(bindings: ScriptBinding[] | null, databaseIds: string[]) {
	if (!bindings) {
		return false;
	}

	const version = bindings.find((binding) => binding.name === 'GATEWAY_VERSION');
	const names = new Set(bindings.map((binding) => binding.name));

	return (
		version?.text === GATEWAY_VERSION &&
		names.has('GATEWAY_TOKEN') &&
		databaseIds.every((id) => names.has(bindingName(id)))
	);
}

/** Uploads the gateway with bindings for these databases, which replaces all of its bindings. */
async function deploy(databaseIds: string[], token: string) {
	const metadata = {
		main_module: GATEWAY_MODULE,
		compatibility_date: COMPATIBILITY_DATE,
		bindings: [
			...databaseIds.map((id) => ({ type: 'd1', name: bindingName(id), id })),
			{ type: 'secret_text', name: 'GATEWAY_TOKEN', text: token },
			{ type: 'plain_text', name: 'GATEWAY_VERSION', text: GATEWAY_VERSION }
		],
		annotations: { 'workers/message': `Pouchbase D1 gateway version ${GATEWAY_VERSION}` }
	};

	const body = new FormData();
	body.set('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
	body.set(
		GATEWAY_MODULE,
		new Blob([GATEWAY_SOURCE], { type: 'application/javascript+module' }),
		GATEWAY_MODULE
	);

	const response = await cloudflareFetch(`/workers/scripts/${encodeURIComponent(GATEWAY_NAME)}`, {
		method: 'PUT',
		body
	});

	if (!response.ok) {
		throw await failure(response);
	}

	await functions.enableSubdomain(GATEWAY_NAME);
}

function post(url: string, token: string, path: string, body: unknown) {
	return fetch(`${url}${path}`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

/**
 * Whether the gateway answers with this version, trying `attempts` times: a new Worker takes a
 * few seconds before workers.dev serves it. `unauthorized` when it runs with another token.
 */
async function probe(url: string, token: string, attempts: number) {
	for (let attempt = 1; attempt <= attempts; attempt++) {
		const response = await post(url, token, '/health', {}).catch(() => null);

		if (response?.headers.has(GATEWAY_HEADER)) {
			if (response.status === 401) {
				return 'unauthorized';
			}

			const body = (await response.json().catch(() => null)) as { version?: string } | null;

			if (response.ok && body?.version === GATEWAY_VERSION) {
				return 'ready';
			}
		}

		if (attempt < attempts) {
			await new Promise((resolve) => setTimeout(resolve, PROBE_INTERVAL));
		}
	}

	return 'unavailable';
}

async function setUp(databaseIds: string[]) {
	const subdomain = await functions.subdomain();

	if (!subdomain) {
		throw new Error(
			'The Cloudflare account has no workers.dev subdomain yet, so the D1 gateway has no URL. Open Workers & Pages in the Cloudflare dashboard once to create it.'
		);
	}

	const url = `https://${GATEWAY_NAME}.${subdomain}.workers.dev`;
	const token = await gatewayToken();
	const deployed = upToDate(await deployedBindings(), databaseIds);

	if (!deployed || (await probe(url, token, 1)) !== 'ready') {
		await deploy(databaseIds, token);

		if ((await probe(url, token, PROBE_ATTEMPTS)) !== 'ready') {
			throw new Error(`The D1 gateway does not answer on ${url}`);
		}

		console.log(`[pouchbase] Deployed the D1 gateway "${GATEWAY_NAME}"`);
	}

	gateway = { url, token, databases: new Set(databaseIds) };
}

/**
 * Deploys the gateway with bindings for these databases, unless it already has them. Does nothing
 * on a Worker, in `vite dev`, while a setup runs, and for a while after one failed. Throws when
 * the setup fails; queries keep using the REST API then.
 */
export function attachGateway(databaseIds: string[]): Promise<void> {
	if (
		!enabled() ||
		pending ||
		Date.now() < retryAt ||
		databaseIds.every((id) => gateway?.databases.has(id))
	) {
		return Promise.resolve();
	}

	pending = setUp(databaseIds)
		.catch((error: unknown) => {
			retryAt = Date.now() + RETRY_AFTER;
			throw error;
		})
		.finally(() => {
			pending = null;
		});

	return pending;
}

/** Whether queries on this database go through the gateway. */
export function hasGateway(databaseId: string) {
	return !!gateway?.databases.has(databaseId);
}

/**
 * Runs a query (`/query`) or batch (`/batch`) on the gateway; `null` when the gateway didn't run
 * it (not deployed under its URL, another token, no binding), so the caller sends it over the
 * REST API instead. Throws when D1 refused a statement, like the REST API does.
 */
export async function gatewayQuery(
	databaseId: string,
	request: { path: '/query'; statement: Statement } | { path: '/batch'; statements: Statement[] }
): Promise<QueryResult[] | null> {
	const current = gateway;

	if (!current?.databases.has(databaseId)) {
		return null;
	}

	const body =
		request.path === '/query'
			? { database: databaseId, ...request.statement }
			: { database: databaseId, statements: request.statements };
	const response = await post(current.url, current.token, request.path, body);

	// Not the gateway's answer (workers.dev itself): nothing ran.
	if (!response.headers.has(GATEWAY_HEADER)) {
		return null;
	}

	const result = (await response.json()) as {
		code?: string;
		error?: string;
		results?: QueryResult[];
	};

	if (result.code === UNAUTHORIZED) {
		// Set up again on the next attach, which deploys it with the current token.
		gateway = null;
		return null;
	}

	if (result.code === NO_BINDING) {
		current.databases.delete(databaseId);
		return null;
	}

	if (!response.ok || !result.results) {
		throw new PlatformError(
			response.status,
			[{ code: 0, message: result.error ?? 'Query failed' }],
			'D1 gateway'
		);
	}

	return result.results;
}
