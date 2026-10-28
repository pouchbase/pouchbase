import { PouchbaseError } from './error.js';
import { AuthService } from './services/auth.js';
import { FilesService } from './services/files.js';
import { FunctionsService } from './services/functions.js';
import { RealtimeService } from './services/realtime.js';
import { MailService } from './services/mail.js';
import { SchemaService } from './services/schema.js';
import { createDb } from './services/db.js';
import type { Db } from './services/db.js';
import { browserStorage, memoryStorage, Session } from './session.js';
import type { SessionStorage } from './session.js';
import type { WebSocketLike } from './realtime/connection.js';
import type { DefaultCollections, DefaultMailTemplates, Issues } from './types.js';

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
	 * API key for server-side code (`pbk_…`), such as `env.POUCHBASE_API_KEY` in a function. The
	 * client then acts as an admin: every request and realtime connection sends the key instead of
	 * the session's token, so the collections' API rules don't apply, and `pouch.mail` and
	 * `pouch.schema` work. Never put one in code that runs in a browser.
	 */
	apiKey?: string;
	/** Headers sent with every request. */
	headers?: Record<string, string>;
	/**
	 * The `WebSocket` class for `pouch.realtime`. Defaults to `globalThis.WebSocket` (browsers, Node 22
	 * and later, Deno, Bun, Workers); pass one, such as `ws`, where there is none.
	 */
	webSocket?: WebSocketLike;
};

/**
 * The members of a client that its services use. Any client fits, whatever its `Schema` and
 * `MailTemplates`.
 */
export type PouchbaseClient = Pick<
	Pouchbase<object>,
	'baseUrl' | 'session' | 'url' | 'request' | 'realtime'
>;

/** Options for `pouch.request()`. */
export type RequestOptions = {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	/** Sent as JSON. */
	body?: unknown;
	/** Added to the URL; `undefined` values are left out. */
	query?: Record<string, string | number | boolean | undefined>;
	headers?: Record<string, string>;
	signal?: AbortSignal;
	/**
	 * Whether to send the `apiKey`, or else the session's token, as `Authorization: Bearer`.
	 * Defaults to `true`.
	 */
	auth?: boolean;
};

/**
 * Client for one Pouchbase instance.
 *
 * ```ts
 * const pouch = new Pouchbase('https://pouchbase.example.com', { session: 'browser' });
 * await pouch.auth.login('ada@example.com', 'correct horse battery staple');
 * const user = await pouch.auth.me();
 * ```
 *
 * Pass the `Schema` from `pouchbase types` to type your collections, or use `createClient()`:
 * `new Pouchbase<Schema>(url)`; `pouch.db.posts` then knows the fields of `posts`. The generated
 * `MailTemplates`, as the second type, types the names and variables of `pouch.mail.send()`.
 *
 * With an `apiKey`, for server-side code, the client acts as an admin on every call:
 *
 * ```ts
 * const pouch = new Pouchbase(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_API_KEY });
 * await pouch.db.posts.patch(id, { featured: true });
 * pouch.realtime.subscribe('posts', (event) => console.log(event.record));
 * ```
 */
export class Pouchbase<
	C extends object = DefaultCollections,
	M extends object = DefaultMailTemplates
> {
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
	 * a caller may do follows each collection's API rules, unless the client has an `apiKey`.
	 */
	readonly db: Db<C>;
	/** Changes to records as they happen, over a WebSocket: `pouch.realtime.subscribe('posts', …)`. */
	readonly realtime: RealtimeService<C>;
	/** Email, sent with the `apiKey`: `pouch.mail.send('welcome', { to, variables })`. */
	readonly mail: MailService<M>;
	/**
	 * The schema (collections, fields, indexes, API rules), export and import; needs an `apiKey`:
	 * `pouch.schema.create({ name, fields })`.
	 */
	readonly schema: SchemaService;

	#fetch: typeof fetch;
	#headers: Record<string, string>;
	#apiKey: string | null;

	constructor(baseUrl: string, options: PouchbaseOptions = {}) {
		this.#apiKey = options.apiKey || null;
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.session = new Session(resolveStorage(options.session));
		this.#fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
		this.#headers = options.headers ?? {};
		this.auth = new AuthService<C>(this);
		this.files = new FilesService(this);
		this.functions = new FunctionsService(this);
		this.db = createDb<C>(this);
		this.realtime = new RealtimeService<C>(this, () => this.#credential() ?? '', options.webSocket);
		this.mail = new MailService<M>(this, options.apiKey);
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
		const token = this.#credential();

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

	/** Whether the instance serves requests (`GET /api/health`). */
	async health(options: { signal?: AbortSignal } = {}): Promise<{ status: 'ok' }> {
		return this.request('/api/health', { auth: false, signal: options.signal });
	}

	/** What requests authenticate with: the `apiKey`, else the session's token. */
	#credential(): string | null {
		return this.#apiKey ?? this.session.token;
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
 * Creates a client for one Pouchbase instance, typed by the `Schema` from `pouchbase types`, and
 * optionally by its `MailTemplates` for `pouch.mail.send()`:
 *
 * ```ts
 * import type { MailTemplates, Schema } from './pouchbase';
 *
 * const pouch = createClient<Schema>('https://pouchbase.example.com', { session: 'browser' });
 * const { items } = await pouch.db.posts.findMany({ where: { status: 'published' } });
 *
 * const server = createClient<Schema, MailTemplates>(env.POUCHBASE_URL, { apiKey });
 * await server.mail.send('welcome', { to: 'ada@example.com', variables: { name: 'Ada' } });
 * ```
 */
export function createClient<
	S extends object = DefaultCollections,
	M extends object = DefaultMailTemplates
>(baseUrl: string, options: PouchbaseOptions = {}): Pouchbase<S, M> {
	return new Pouchbase<S, M>(baseUrl, options);
}
