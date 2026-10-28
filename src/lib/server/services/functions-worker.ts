import type { AppUser } from './auth.service';
import type { functions } from '../db';

import { USER_HEADER } from '#lib/functions/functions.js';

import { reasonOf } from '../errors';
import {
	ENTRY_CODE,
	ENTRY_MODULE,
	FUNCTION_MODULE,
	headerJson,
	scriptName,
	SECRET_HEADER
} from '../functions';
import { functions as driver, PlatformError } from '../platform';

/**
 * The Worker of a function, for `FunctionsService`: uploading its code and sending requests to
 * it. These functions throw; the service turns that into its result.
 */

export type FunctionRow = typeof functions.$inferSelect;

export type FunctionRequest = {
	method: string;
	/** Path after `/api/functions/<name>`, with the query string, e.g. `/hello?name=Ada`. */
	path: string;
	headers: Record<string, string>;
	body: string | null;
};

export type FunctionResponse = {
	status: number;
	statusText: string;
	headers: [string, string][];
	body: string;
	/** The body was cut off after `MAX_TEST_BODY` characters. */
	truncated: boolean;
	durationMs: number;
};

/** Headers a caller can't pass on to a function. */
const STRIPPED_HEADERS = [
	'host',
	// The admin's session cookie on this origin must never reach a function.
	'cookie',
	SECRET_HEADER,
	USER_HEADER,
	'content-length',
	'cf-connecting-ip',
	'cf-ray',
	'cf-visitor',
	'cf-worker',
	'cf-ew-via',
	'x-forwarded-host',
	'x-forwarded-proto'
];

/** How much of a response body the test panel shows. */
const MAX_TEST_BODY = 100_000;

/** How long the test panel waits for a function. */
const TEST_TIMEOUT = 30_000;

/**
 * What the API said, e.g. the syntax error a deploy failed with: the messages of the Cloudflare
 * API without its status and codes, or the reason of any other error.
 */
export function apiReason(error: unknown) {
	if (error instanceof PlatformError && error.errors.length) {
		return error.errors.map((item) => item.message).join('; ');
	}

	return reasonOf(error) ?? String(error);
}

/** Why a test request failed, for the test panel. */
export function testReason(error: unknown) {
	return error instanceof Error && error.name === 'TimeoutError'
		? `No response within ${TEST_TIMEOUT / 1000} seconds`
		: apiReason(error);
}

/** The request to the Worker: the path below its URL, with the secret and the user. */
export function workerRequest(
	row: FunctionRow,
	path: string,
	method: string,
	incoming: Headers,
	user: AppUser | null
) {
	const url = new URL(path.startsWith('/') ? path : `/${path}`, row.url!);
	const headers = new Headers(incoming);

	for (const header of STRIPPED_HEADERS) {
		headers.delete(header);
	}

	headers.set(SECRET_HEADER, row.secret);

	if (user) {
		headers.set(USER_HEADER, headerJson(user));
	}

	return new Request(url, { method, headers, redirect: 'manual' });
}

/** Uploads the code to the function's Worker, as version `number`, and makes it reachable. */
export async function uploadWorker(
	row: FunctionRow,
	upload: { code: string; number: number; origin: string; apiKey: string }
) {
	const script = scriptName(row.name);

	await driver.deploy(script, {
		mainModule: ENTRY_MODULE,
		modules: [
			{ name: ENTRY_MODULE, content: ENTRY_CODE },
			{ name: FUNCTION_MODULE, content: upload.code }
		],
		bindings: [
			{ type: 'plain_text', name: 'POUCHBASE_URL', text: upload.origin },
			{ type: 'secret_text', name: 'POUCHBASE_FUNCTION_SECRET', text: row.secret },
			{ type: 'secret_text', name: 'POUCHBASE_API_KEY', text: upload.apiKey }
		],
		message: `Pouchbase version ${upload.number}`
	});

	if (!row.url) {
		await driver.enableSubdomain(script);
	}
}

/** Sends a request from the test panel, without a user, and reads the whole response. */
export async function testWorker(
	row: FunctionRow,
	input: FunctionRequest
): Promise<FunctionResponse> {
	const started = performance.now();
	const response = await fetch(
		workerRequest(row, input.path, input.method, new Headers(input.headers), null),
		{
			body: input.method === 'GET' || input.method === 'HEAD' ? null : input.body,
			signal: AbortSignal.timeout(TEST_TIMEOUT)
		}
	);
	const body = await response.text();

	return {
		status: response.status,
		statusText: response.statusText,
		headers: [...response.headers],
		body: body.slice(0, MAX_TEST_BODY),
		truncated: body.length > MAX_TEST_BODY,
		durationMs: Math.round(performance.now() - started)
	};
}
