import { PouchbaseError } from './error.js';
import { AuthService } from './services/auth.js';
import { FilesService } from './services/files.js';
import { FunctionsService } from './services/functions.js';
import { LiveService } from './services/live.js';
import { MailService } from './services/mail.js';
import { SchemaService } from './services/schema.js';
import { createDb } from './services/db.js';
import type { Db } from './services/db.js';
import { browserStorage, memoryStorage, Session } from './session.js';
import type { SessionStorage } from './session.js';
import type { WebSocketLike } from './live/connection.js';
import type { DefaultCollections, Issues } from './types.js';

/** Options for `new Pouchbase()`. */
export type PouchbaseOptions = {
	/**
	 * Where the session is kept between page loads: `'memory'` (the default) keeps it as long as the
	 * client, `'browser'` keeps it in `localStorage` (see `browserStorage()`), or pass your own
	 * `SessionStorage`.
	 */
	session?: 'memory' | 'browser' | SessionStorage;
	/** The `fetch` to use, for example to add retries or for tests. Defaults to `globalThis.fetch`. */
	fetch?: typeof fetch;
	/**
	 * API key for server-side code (`pbk_…`), such as `env.POUCHBASE_API_KEY` in a function; needed
	 * for `pouch.mail.send()`, `pouch.schema` and `pouch.asService()`. Never put one in code that
	 * runs in a browser.
	 */
	apiKey?: string;
	/** Headers sent with every request. */
	headers?: Record<string, string>;
	/**
	 * The `WebSocket` class for `pouch.live`. Defaults to `globalThis.WebSocket` (browsers, Node 22
	 * and later, Deno, Bun, Workers); pass one, such as `ws`, where there is none.
	 */
	webSocket?: WebSocketLike;
};

/** Options for `pouch.request()`. */
export type RequestOptions = {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	/** Sent as JSON. */
	body?: unknown;
	/** Added to the URL; `undefined` values are left out. */
	query?: Record<string, string | number | boolean | undefined>;
	headers?: Record<string, string>;
	signal?: AbortSignal;
	/** Whether to send the session's token as `Authorization: Bearer`. Defaults to `true`. */
	auth?: boolean;
};

/**
 * Client for one Pouchbase instance.
 *
 * ```ts
 * const pouch = new Pouchbase('https://pouchbase.example.com', { session: 'browser' });
 * await pouch.auth.signIn('ada@example.com', 'correct horse battery staple');
 * const user = await pouch.auth.me();
 * ```
 *
 * Pass the `Schema` from `pouchbase types` to type your collections, or use `createClient()`:
 * `new Pouchbase<Schema>(url)`; `pouch.db.posts` then knows the fields of `posts`.
 */
export class Pouchbase<C extends object = DefaultCollections> {
	/** The instance's origin, without a trailing slash. */
	readonly baseUrl: string;
	/** The signed-in user's session; while it lasts, its token is sent with every request. */
	readonly session: Session;
	/** Sign-up, sign-in, OAuth, password resets and email verification. */
	readonly auth: AuthService<C>;
	/** URLs of files in the `files` collection. */
	readonly files: FilesService;
	/** Serverless functions. */
	readonly functions: FunctionsService;
	/**
	 * The records of every collection, typed by the schema: `pouch.db.posts.findMany({ … })`. What
	 * a caller may do follows each collection's API rules.
	 */
	readonly db: Db<C>;
	/** Live changes to records over a WebSocket: `pouch.live.watch('posts', …)`. */
	readonly live: LiveService;
	/** Email templates, sent with the `apiKey`: `pouch.mail.send({ template, to, variables })`. */
	readonly mail: MailService;
	/**
	 * The schema (collections, fields, indexes, API rules), export and import; needs an `apiKey`
	 * with the `service` scope: `pouch.schema.create({ name, fields })`.
	 */
	readonly schema: SchemaService;

	#fetch: typeof fetch;
	#headers: Record<string, string>;
	#options: PouchbaseOptions;

	constructor(baseUrl: string, options: PouchbaseOptions = {}) {
		this.#options = options;
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.session = new Session(resolveStorage(options.session));
		this.#fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
		this.#headers = options.headers ?? {};
		this.auth = new AuthService<C>(this);
		this.files = new FilesService(this);
		this.functions = new FunctionsService(this);
		this.db = createDb<C>(this);
		this.live = new LiveService(this, options.webSocket);
		this.mail = new MailService(this, options.apiKey);
		this.schema = new SchemaService(this, options.apiKey);
	}

	/** Absolute URL of an API path, such as `/api/health`. */
	url(path: string, query: RequestOptions['query'] = {}): string {
		const url = new URL(this.baseUrl + (path.startsWith('/') ? path : `/${path}`));

		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined) {
				url.searchParams.set(key, String(value));
			}
		}

		return url.toString();
	}

	/**
	 * Sends a request to the API and returns the parsed JSON body.
	 * @throws {PouchbaseError} For a non-2xx response or when the request fails.
	 */
	async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
		const headers: Record<string, string> = { Accept: 'application/json', ...this.#headers };
		const token = this.session.token;

		if (options.body !== undefined) {
			headers['Content-Type'] = 'application/json';
		}

		if (options.auth !== false && token) {
			headers.Authorization = `Bearer ${token}`;
		}

		let response: Response;

		try {
			response = await this.#fetch(this.url(path, options.query), {
				method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
				headers: { ...headers, ...options.headers },
				body: options.body === undefined ? undefined : JSON.stringify(options.body),
				signal: options.signal
			});
		} catch (cause) {
			throw new PouchbaseError('Could not reach Pouchbase', { cause });
		}

		const data = await readBody(response);

		if (!response.ok) {
			const body = (data && typeof data === 'object' ? data : {}) as {
				message?: unknown;
				code?: unknown;
				issues?: unknown;
			};

			throw new PouchbaseError(
				typeof body.message === 'string' ? body.message : `Request failed (${response.status})`,
				{
					status: response.status,
					code: typeof body.code === 'string' ? body.code : undefined,
					issues: isIssues(body.issues) ? body.issues : {},
					data
				}
			);
		}

		return data as T;
	}

	/**
	 * A client that sends the `apiKey` instead of the signed-in user's token, for server-side code
	 * with a key of the `service` scope: its records calls skip the collections' API rules, as an
	 * admin would. Other keys get `403` from the records API. It has a session of its own, in memory.
	 *
	 * ```ts
	 * const pouch = new Pouchbase(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_SERVICE_KEY });
	 * await pouch.asService().db.posts.patch(id, { featured: true });
	 * ```
	 *
	 * @throws {PouchbaseError} Without an `apiKey`.
	 */
	asService(): Pouchbase<C> {
		const { apiKey } = this.#options;

		if (!apiKey) {
			throw new PouchbaseError(
				'A service client needs an API key: new Pouchbase(url, { apiKey })',
				{ status: 401 }
			);
		}

		return new Pouchbase<C>(this.baseUrl, {
			...this.#options,
			session: 'memory',
			headers: { ...this.#headers, Authorization: `Bearer ${apiKey}` }
		});
	}

	/** Whether the instance serves requests (`GET /api/health`). */
	async health(options: { signal?: AbortSignal } = {}): Promise<{ status: 'ok' }> {
		return this.request('/api/health', { auth: false, signal: options.signal });
	}
}

function resolveStorage(option: PouchbaseOptions['session']): SessionStorage {
	if (option === 'browser') {
		return browserStorage();
	}

	if (option === undefined || option === 'memory') {
		return memoryStorage();
	}

	return option;
}

async function readBody(response: Response): Promise<unknown> {
	const text = await response.text().catch(() => '');

	if (!text) {
		return null;
	}

	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

function isIssues(value: unknown): value is Issues {
	return (
		!!value &&
		typeof value === 'object' &&
		Object.values(value).every((message) => typeof message === 'string')
	);
}

/**
 * Creates a client for one Pouchbase instance, typed by the `Schema` from `pouchbase types`:
 *
 * ```ts
 * import type { Schema } from './pouchbase';
 *
 * const pouch = createClient<Schema>('https://pouchbase.example.com', { session: 'browser' });
 * const { items } = await pouch.db.posts.findMany({ where: { status: 'published' } });
 * ```
 */
export function createClient<S extends object = DefaultCollections>(
	baseUrl: string,
	options: PouchbaseOptions = {}
): Pouchbase<S> {
	return new Pouchbase<S>(baseUrl, options);
}
