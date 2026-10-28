import type { RequestHandler } from './$types';

import { json, preflight, requestAccess } from '#lib/server/api.js';
import { readJsonObject } from '#lib/server/api-body.js';

import { errorResponse, readOptions } from './responses';

const MAX_LIMIT = 500;

/** A whole number of at least `min` from the query, `fallback` when missing, `null` when invalid. */
function integer(value: string | null, fallback: number, min: number) {
	if (value === null || value === '') {
		return fallback;
	}

	const number = Number(value);

	return Number.isSafeInteger(number) && number >= min ? number : null;
}

/**
 * Lists the records of a collection that its list rule allows.
 * Query: `where` (`status == "published" && views > 10`), `order` (`created_at:desc,title`),
 * `select` (`id,title`), `include` (`author,comments.author`: relation fields to replace by their
 * records), `limit` (default 30, at most 500) and `offset` (default 0) → `{ items, total, limit,
 * offset }`.
 */
export const GET: RequestHandler = async (event) => {
	const { params, url, locals } = event;
	const limit = integer(url.searchParams.get('limit'), 30, 1);
	const offset = integer(url.searchParams.get('offset'), 0, 0);

	if (limit === null || offset === null || limit > MAX_LIMIT) {
		return json(
			{ message: `\`limit\` must be between 1 and ${MAX_LIMIT} and \`offset\` 0 or more` },
			400
		);
	}

	const caller = await requestAccess(event);

	if ('response' in caller) {
		return caller.response;
	}

	const result = await locals.services.records().apiList(
		params.collection,
		{
			limit,
			offset,
			order: url.searchParams.get('order') ?? undefined,
			where: url.searchParams.get('where') ?? undefined,
			...readOptions(url)
		},
		caller.access
	);

	if (result.isErr()) {
		return errorResponse(result.error, 'Could not list the records');
	}

	return json(result.value);
};

/**
 * Creates a record when the collection's create rule allows it. Body: a JSON object with a value
 * per field → the new record (only `?select=` when given, with the relations in `?include=`
 * replaced by their records). Fields that are left out get their default value.
 */
export const POST: RequestHandler = async (event) => {
	const { params, request, url, locals } = event;
	const body = await readJsonObject(request);

	if (!body) {
		return json({ message: 'Send a JSON object with a value per field' }, 400);
	}

	const caller = await requestAccess(event);

	if ('response' in caller) {
		return caller.response;
	}

	const result = await locals.services
		.records()
		.apiCreate(params.collection, body, caller.access, readOptions(url));

	if (result.isErr()) {
		return errorResponse(result.error, 'Could not create the record');
	}

	return json(result.value);
};

export const OPTIONS: RequestHandler = preflight;
