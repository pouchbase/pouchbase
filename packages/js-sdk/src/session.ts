import { decodeToken, isTokenValid } from './jwt.js';
import type { User } from './types.js';

/** The signed-in user's session: the token, the user's id and, once loaded, the user. */
export type SessionData = {
	token: string;
	userId: string;
	/** The user from the last `pouch.auth.me()`, or `null` until it is loaded. */
	user: User | null;
};

/** Called with the session after every change; `null` once it ended. */
export type SessionListener = (session: SessionData | null) => void;

/**
 * Where a session is kept between page loads. `load()` is called once, when the client is made;
 * `persist()` after every change and `forget()` when the session ends. Implement it to keep the
 * session somewhere else, such as cookies or a secure store.
 */
export type SessionStorage = {
	/** The stored session, or `null` when there is none. */
	load(): SessionData | null;
	/** Stores the session, replacing the previous one. */
	persist(session: SessionData): void;
	/** Removes the stored session. */
	forget(): void;
};

/** A storage that keeps nothing: the session lasts as long as the client. */
export function memoryStorage(): SessionStorage {
	return {
		load: () => null,
		persist: () => undefined,
		forget: () => undefined
	};
}

/**
 * A storage in `localStorage` under `key` (browsers only), so users stay signed in across reloads.
 * Where `localStorage` isn't available or is blocked, it keeps nothing.
 */
export function browserStorage(key = 'pouchbase_session'): SessionStorage {
	return {
		load() {
			try {
				const raw = globalThis.localStorage?.getItem(key);

				return raw ? parseSession(JSON.parse(raw)) : null;
			} catch {
				// Storage is blocked or holds something else: start signed out.
				return null;
			}
		},
		persist(session) {
			try {
				globalThis.localStorage?.setItem(key, JSON.stringify(session));
			} catch {
				// Storage is blocked or full: the session lasts as long as the client.
			}
		},
		forget() {
			try {
				globalThis.localStorage?.removeItem(key);
			} catch {
				// Storage is blocked: nothing was stored.
			}
		}
	};
}

function parseSession(value: unknown): SessionData | null {
	if (
		value &&
		typeof value === 'object' &&
		'token' in value &&
		typeof value.token === 'string' &&
		value.token !== '' &&
		'userId' in value &&
		typeof value.userId === 'string'
	) {
		const user = 'user' in value ? value.user : null;

		return {
			token: value.token,
			userId: value.userId,
			user: user && typeof user === 'object' ? (user as User) : null
		};
	}

	return null;
}

/**
 * The session of the signed-in user, as `pouch.session`. Sign-ins begin it, `pouch.auth.signOut()`
 * ends it, and while it lasts its token is sent as `Authorization: Bearer` with every request.
 *
 * ```ts
 * const pouch = createClient<Schema>(url, { session: 'browser' });
 *
 * pouch.session.watch((session) => {
 * 	console.log(session ? `Signed in as ${session.userId}` : 'Signed out');
 * });
 * ```
 */
export class Session {
	#data: SessionData | null;
	readonly #storage: SessionStorage;
	readonly #listeners = new Set<SessionListener>();

	/** Starts with the session `storage` holds, if any. */
	constructor(storage: SessionStorage = memoryStorage()) {
		this.#storage = storage;
		this.#data = storage.load();
	}

	/** The token, or `null` when signed out. */
	get token(): string | null {
		return this.#data?.token ?? null;
	}

	/** Id of the signed-in user, or `null` when signed out. */
	get userId(): string | null {
		return this.#data?.userId ?? null;
	}

	/** The user from the last `pouch.auth.me()`, or `null`. */
	get user(): User | null {
		return this.#data?.user ?? null;
	}

	/** Whether there is a token that hasn't expired. The server can still reject it. */
	get signedIn(): boolean {
		return this.#data !== null && isTokenValid(this.#data.token);
	}

	/** When the token expires (its `exp`), or `null` when signed out or it doesn't say. */
	get expiresAt(): Date | null {
		const exp = this.#data ? decodeToken(this.#data.token)?.exp : undefined;

		return typeof exp === 'number' ? new Date(exp * 1000) : null;
	}

	/** Starts a session (or replaces the current one), stores it and notifies the listeners. */
	begin(session: { token: string; userId: string; user?: User | null }): void {
		this.#data = { token: session.token, userId: session.userId, user: session.user ?? null };
		this.#storage.persist(this.#data);
		this.#emit();
	}

	/** Ends the session (signs out locally), forgets it in storage and notifies the listeners. */
	end(): void {
		this.#data = null;
		this.#storage.forget();
		this.#emit();
	}

	/**
	 * Calls `listener` after every change, and right away when `immediate` is set.
	 * @returns A function that removes the listener.
	 */
	watch(listener: SessionListener, options: { immediate?: boolean } = {}): () => void {
		this.#listeners.add(listener);

		if (options.immediate) {
			listener(this.#data);
		}

		return () => {
			this.#listeners.delete(listener);
		};
	}

	#emit() {
		for (const listener of this.#listeners) {
			listener(this.#data);
		}
	}
}
