import { timingSafeEqual } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
	GATEWAY_HEADER,
	GATEWAY_SOURCE,
	GATEWAY_VERSION,
	NO_BINDING,
	QUERY_FAILED,
	UNAUTHORIZED
} from './gateway-worker';

type Handler = { fetch(request: Request, env: Record<string, unknown>): Promise<Response> };

const DATABASE_ID = '0b5c-41de';
const TOKEN = 'secret';

/** A D1 binding that records what it ran and answers with fixed rows. */
function fakeD1() {
	const ran: { sql: string; params: unknown[] }[] = [];

	const prepare = (sql: string) => ({
		bind: (...params: unknown[]) => ({
			sql,
			params,
			async raw() {
				ran.push({ sql, params });

				if (sql.startsWith('FAIL')) {
					throw new Error('D1_ERROR: UNIQUE constraint failed: users.email');
				}

				return [
					['id', 'name'],
					[1, 'Ada']
				];
			}
		})
	});

	return {
		ran,
		prepare,
		async batch(statements: { sql: string; params: unknown[] }[]) {
			ran.push(...statements.map(({ sql, params }) => ({ sql, params })));

			return statements.map(() => ({ results: [{ id: 2, name: 'Grace' }] }));
		}
	};
}

let directory: string;
let gateway: Handler;
let db: ReturnType<typeof fakeD1>;
let env: Record<string, unknown>;

function call(path: string, body: unknown, token = TOKEN) {
	return gateway.fetch(
		new Request(`https://pouchbase-gateway.example.workers.dev${path}`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}` },
			body: JSON.stringify(body)
		}),
		env
	);
}

beforeAll(async () => {
	// Workers have a non-standard `crypto.subtle.timingSafeEqual`; Node has it in `node:crypto`.
	Object.assign(crypto.subtle, {
		timingSafeEqual: (a: Uint8Array, b: Uint8Array) => timingSafeEqual(a, b)
	});

	directory = await mkdtemp(join(tmpdir(), 'pouchbase-gateway-'));
	const file = join(directory, 'gateway.mjs');
	await writeFile(file, GATEWAY_SOURCE);
	gateway = ((await import(/* @vite-ignore */ pathToFileURL(file).href)) as { default: Handler })
		.default;
});

afterAll(async () => {
	await rm(directory, { recursive: true, force: true });
});

describe('gateway worker', () => {
	// Fresh bindings per test, so `ran` only holds what that test sent.
	beforeEach(() => {
		db = fakeD1();
		env = { GATEWAY_TOKEN: TOKEN, GATEWAY_VERSION, D1_0B5C_41DE: db };
	});

	it('refuses a request without the right token, marked as its own answer', async () => {
		const response = await call('/health', {}, 'wrong');

		expect(response.status).toBe(401);
		expect(response.headers.get(GATEWAY_HEADER)).toBe('1');
		expect(await response.json()).toMatchObject({ code: UNAUTHORIZED });
	});

	it('answers the health check with its version', async () => {
		const response = await call('/health', {});

		expect(await response.json()).toEqual({ version: GATEWAY_VERSION });
	});

	it('runs a query on the binding of the database', async () => {
		const response = await call('/query', {
			database: DATABASE_ID,
			sql: 'SELECT id, name FROM users WHERE id = ?',
			params: [1, null]
		});

		expect(await response.json()).toEqual({
			results: [{ columns: ['id', 'name'], rows: [[1, 'Ada']] }]
		});
		expect(db.ran).toEqual([{ sql: 'SELECT id, name FROM users WHERE id = ?', params: [1, null] }]);
	});

	it('runs a batch and returns rows as arrays', async () => {
		const response = await call('/batch', {
			database: DATABASE_ID,
			statements: [{ sql: 'SELECT 1' }, { sql: 'SELECT 2', params: ['x'] }]
		});

		expect(await response.json()).toEqual({
			results: [
				{ columns: ['id', 'name'], rows: [[2, 'Grace']] },
				{ columns: ['id', 'name'], rows: [[2, 'Grace']] }
			]
		});
		expect(db.ran.map((statement) => statement.params)).toEqual([[], ['x']]);
	});

	it('says when it has no binding for a database, without running anything', async () => {
		const response = await call('/query', { database: 'other', sql: 'SELECT 1' });

		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({ code: NO_BINDING });
		expect(db.ran).toEqual([]);
	});

	it('passes on the message of a statement D1 refused', async () => {
		const response = await call('/query', { database: DATABASE_ID, sql: 'FAIL' });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			code: QUERY_FAILED,
			error: 'D1_ERROR: UNIQUE constraint failed: users.email'
		});
	});
});
