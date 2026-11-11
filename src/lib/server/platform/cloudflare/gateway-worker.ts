/**
 * The code of the D1 gateway: a small Worker that a Node instance deploys next to its databases, so
 * its queries go through D1 bindings instead of the REST API (see `./gateway`). Kept free of app
 * imports so the tests can run the module itself.
 *
 * It answers `POST /health`, `POST /query` (`{ database, sql, params }`) and `POST /batch`
 * (`{ database, statements }`) with `{ results: [{ columns, rows }] }`, behind the bearer token in
 * `GATEWAY_TOKEN`. Every answer carries `GATEWAY_HEADER`, so the caller can tell its answers from
 * those of workers.dev itself (e.g. right after the deploy, before the URL serves the Worker).
 */

/** Name of the module in the upload. */
export const GATEWAY_MODULE = 'gateway.js';

/** Set on every answer of the gateway. */
export const GATEWAY_HEADER = 'x-pouchbase-gateway';

/**
 * Deployed with the Worker as a plain-text binding; a gateway with another version is deployed
 * again. Raise it whenever `GATEWAY_SOURCE` changes.
 */
export const GATEWAY_VERSION = '1';

/** `code` of an answer for a database the gateway has no binding for: nothing ran. */
export const NO_BINDING = 'NO_BINDING';

/** `code` of an answer to a request without the right token: nothing ran. */
export const UNAUTHORIZED = 'UNAUTHORIZED';

/** `code` of an answer to a statement D1 refused. */
export const QUERY_FAILED = 'QUERY_FAILED';

/**
 * The binding names follow `bindingName` in `./bindings`, which the main Worker uses for its own
 * D1 bindings.
 */
export const GATEWAY_SOURCE = `const HEADER = ${JSON.stringify(GATEWAY_HEADER)};
const encoder = new TextEncoder();

function reply(status, body) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', [HEADER]: '1' }
	});
}

function authorized(request, token) {
	const given = encoder.encode(request.headers.get('authorization') ?? '');
	const expected = encoder.encode('Bearer ' + token);

	return given.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(given, expected);
}

function binding(env, databaseId) {
	return typeof databaseId === 'string'
		? env['D1_' + databaseId.replace(/-/g, '_').toUpperCase()]
		: undefined;
}

// A binding can't bind undefined; the REST API treats it as null, so do the same.
function prepare(db, { sql, params = [] }) {
	return db.prepare(sql).bind(...params.map((value) => (value === undefined ? null : value)));
}

// A batch returns rows as objects, so the columns are read from the first row.
function toResult(objects) {
	const columns = Object.keys(objects[0] ?? {});

	return { columns, rows: objects.map((row) => columns.map((column) => row[column])) };
}

export default {
	async fetch(request, env) {
		if (!env.GATEWAY_TOKEN || !authorized(request, env.GATEWAY_TOKEN)) {
			return reply(401, { code: ${JSON.stringify(UNAUTHORIZED)}, error: 'Invalid gateway token' });
		}

		const { pathname } = new URL(request.url);

		if (request.method !== 'POST') {
			return reply(405, { error: 'Method not allowed' });
		}

		if (pathname === '/health') {
			return reply(200, { version: env.GATEWAY_VERSION });
		}

		if (pathname !== '/query' && pathname !== '/batch') {
			return reply(404, { error: 'Not found' });
		}

		const body = await request.json();
		const db = binding(env, body.database);

		if (!db) {
			return reply(404, { code: ${JSON.stringify(NO_BINDING)}, error: 'No binding for this database' });
		}

		try {
			if (pathname === '/query') {
				const [columns = [], ...rows] = await prepare(db, body).raw({ columnNames: true });

				return reply(200, { results: [{ columns, rows }] });
			}

			const results = await db.batch(body.statements.map((statement) => prepare(db, statement)));

			return reply(200, { results: results.map((result) => toResult(result.results)) });
		} catch (error) {
			return reply(400, {
				code: ${JSON.stringify(QUERY_FAILED)},
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
};
`;
