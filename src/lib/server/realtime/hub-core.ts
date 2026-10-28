import type {
	ClientMessage,
	RealtimeAction,
	RealtimeErrorCode,
	ServerMessage
} from '../../realtime/protocol.ts';

import { CLOSE, LIMITS } from '../../realtime/protocol.ts';

import { parseClientMessage } from './client-message.ts';

/**
 * The part of a realtime hub that both runtimes share: the Durable Object on Workers
 * (`durable-object.ts`) and the `ws` server on Node (`node-hub.ts`). One `HubCore` serves the
 * sockets of one collection. It keeps no logic about records or rules itself: who a socket is,
 * whether it may subscribe and who may see an event are answered by the app, through the internal
 * routes under `/internal/realtime/` (`InternalCall`). The hubs only differ in where they keep
 * their state (`HubStore`) and how they talk to sockets (`HubTransport`).
 *
 * Only relative imports: the Worker bundles this file outside of Vite (`scripts/worker-entry.mjs`).
 */

/** Who a socket belongs to. `auth` is the user's row of `users`, as API rules see it. */
export type Subject =
	{ kind: 'admin' } | { kind: 'user'; auth: Record<string, unknown> } | { kind: 'anonymous' };

/** A saved change, as `RecordsService` hands it to the hub of its collection. */
export type RecordEvent = {
	collection: string;
	action: RealtimeAction;
	/** The record key as text: the value of the ID field, or the `rowid`. */
	id: string;
	/** The stored value of every field but blobs, by name. */
	row: Record<string, unknown>;
	at: number;
};

export type Subscription = {
	id: string;
	record: string | null;
	filter: string | null;
	fields: string[] | null;
	/** Relations to send as records, as `?include=` of the records API. */
	expand: string[] | null;
};

/**
 * One subject with one filter and one `expand`: what the authorize route checks, and expands,
 * once per event.
 */
export type AccessContext = {
	key: string;
	subject: Subject;
	filter: string | null;
	expand: string[] | null;
};

export type SocketState = {
	id: string;
	/** `null` until `auth`. */
	subject: Subject | null;
	/** When the token expires (ms), for app users. */
	expiresAt: number | null;
	/** When the socket is closed without `auth` (ms); `null` once authenticated. */
	deadline: number | null;
	/** The `cookie` header of the upgrade, only when it came from the same origin. */
	cookie: string | null;
};

export interface HubStore {
	addSocket(socket: { id: string; cookie: string | null; deadline: number }): void;
	socket(id: string): SocketState | null;
	authenticate(id: string, subject: Subject, expiresAt: number | null): void;
	/** Removes the socket and its subscriptions. */
	removeSocket(id: string): void;
	subscriptions(socketId: string): Subscription[];
	addSubscription(socketId: string, subscription: Subscription): void;
	removeSubscription(socketId: string, id: string): void;
	/** Subscriptions of authenticated sockets to every record or to record `recordId`. */
	subscribers(
		recordId: string
	): { socketId: string; subject: Subject; subscription: Subscription }[];
	/** Sockets past their auth deadline or token expiry. */
	due(now: number): { id: string; code: number; reason: string }[];
	/** The next auth deadline or token expiry, if any. */
	nextWake(): number | null;
}

export interface HubTransport {
	/** Sends to the socket; does nothing when it is gone. */
	send(socketId: string, message: ServerMessage): void;
	close(socketId: string, code: number, reason: string): void;
}

export type InternalPath = 'session' | 'subscribe' | 'authorize';

/** A call to `/internal/realtime/<path>`; `cookie` is passed on as the request's cookie header. */
export type InternalCall = (
	path: InternalPath,
	body: unknown,
	cookie?: string | null
) => Promise<{ status: number; body: unknown }>;

/** What `/internal/realtime/session` answers. */
export type SessionResult = { subject: Subject; expiresAt: number | null };

/** What `/internal/realtime/subscribe` answers when it refuses (4xx). */
export type SubscribeRefusal = { code: RealtimeErrorCode; message: string };

/**
 * What `/internal/realtime/authorize` answers: per item, the record, the allowed context keys and,
 * for allowed contexts with `expand`, the record with its relations expanded, by context key.
 * `userRecord` is the record without its hidden fields, for subjects other than admins; it is only
 * there when the collection has hidden fields.
 */
export type AuthorizeResult = {
	results: ({
		record: Record<string, unknown>;
		userRecord?: Record<string, unknown>;
		allowed: string[];
		expanded?: Record<string, Record<string, unknown>>;
	} | null)[];
};

/**
 * The key of a subject with a filter and an `expand`: subscriptions with the same key see the same
 * events, with the same related records.
 */
export function contextKey(
	subject: Subject,
	filter: string | null,
	expand: string[] | null = null
) {
	const who = subject.kind === 'user' ? `user:${String(subject.auth.id ?? '')}` : subject.kind;
	return JSON.stringify(expand ? [who, filter, expand] : [who, filter]);
}

/**
 * Only `fields` of a record, or all of it. The fields `expand` starts with are always kept, as
 * the records API does.
 */
export function pickFields(
	record: Record<string, unknown>,
	fields: string[] | null,
	expand: string[] | null = null
) {
	if (!fields) {
		return record;
	}

	const names = new Set([...fields, ...(expand ?? []).map((path) => path.split('.')[0].trim())]);

	return Object.fromEntries([...names].map((name) => [name, record[name]]));
}

export class HubCore {
	readonly collection: string;
	readonly #store: HubStore;
	readonly #transport: HubTransport;
	readonly #internal: InternalCall;
	readonly #now: () => number;
	/** Invalid messages in a row, per socket. Lost when a Durable Object hibernates, which is fine. */
	readonly #strikes = new Map<string, number>();
	/** Sockets whose `auth` is being checked. */
	readonly #authenticating = new Set<string>();

	constructor(options: {
		collection: string;
		store: HubStore;
		transport: HubTransport;
		internal: InternalCall;
		now?: () => number;
	}) {
		this.collection = options.collection;
		this.#store = options.store;
		this.#transport = options.transport;
		this.#internal = options.internal;
		this.#now = options.now ?? Date.now;
	}

	/** A new socket; it has `LIMITS.AUTH_DEADLINE_MS` to send `auth`. */
	open(id: string, cookie: string | null) {
		this.#store.addSocket({ id, cookie, deadline: this.#now() + LIMITS.AUTH_DEADLINE_MS });
	}

	closed(id: string) {
		this.#store.removeSocket(id);
		this.#strikes.delete(id);
		this.#authenticating.delete(id);
	}

	async message(id: string, text: string) {
		if (text.length > LIMITS.MAX_MESSAGE_BYTES) {
			this.#close(id, CLOSE.MESSAGE_TOO_BIG, 'Message too big');
			return;
		}

		const socket = this.#store.socket(id);

		if (!socket) {
			return;
		}

		const message = parseClientMessage(text);

		if ('error' in message) {
			this.#invalid(id, message.error);
			return;
		}

		this.#strikes.delete(id);

		switch (message.type) {
			case 'auth':
				return this.#auth(socket, message.token);
			case 'subscribe':
				return this.#subscribe(socket, message);
			case 'unsubscribe':
				this.#store.removeSubscription(id, message.id);
				this.#transport.send(id, { type: 'unsubscribed', id: message.id });
		}
	}

	/**
	 * Sends the events to the subscriptions that may see them: one authorize call for all of them,
	 * which checks the view rule and the filter once per subject and filter.
	 */
	async publish(events: RecordEvent[]) {
		const items = events
			.filter((event) => event.collection === this.collection)
			.map((event) => {
				const subscribers = this.#store.subscribers(event.id);
				const contexts = new Map<string, AccessContext>();

				for (const { subject, subscription } of subscribers) {
					const key = contextKey(subject, subscription.filter, subscription.expand);

					if (!contexts.has(key)) {
						contexts.set(key, {
							key,
							subject,
							filter: subscription.filter,
							expand: subscription.expand
						});
					}
				}

				return { event, subscribers, contexts: [...contexts.values()] };
			})
			.filter((item) => item.subscribers.length);

		if (!items.length) {
			return;
		}

		const response = await this.#call('authorize', {
			collection: this.collection,
			items: items.map(({ event, contexts }) => ({ event, contexts }))
		});

		if (response.status !== 200) {
			console.error(`[realtime] authorize failed (${response.status})`, response.body);
			return;
		}

		const { results } = response.body as AuthorizeResult;

		items.forEach(({ event, subscribers }, index) => {
			const result = results[index];

			if (!result) {
				return;
			}

			const allowed = new Set(result.allowed);

			for (const { socketId, subject, subscription } of subscribers) {
				const key = contextKey(subject, subscription.filter, subscription.expand);

				if (allowed.has(key)) {
					this.#transport.send(socketId, {
						type: 'event',
						id: subscription.id,
						action: event.action,
						record: pickFields(
							result.expanded?.[key] ??
								(subject.kind === 'admin' ? result.record : (result.userRecord ?? result.record)),
							subscription.fields,
							subscription.expand
						),
						at: event.at
					});
				}
			}
		});
	}

	/** Closes sockets past their deadline or expiry; returns when to call it again. */
	tick(): number | null {
		for (const { id, code, reason } of this.#store.due(this.#now())) {
			this.#close(id, code, reason);
		}

		return this.#store.nextWake();
	}

	async #auth(socket: SocketState, token: string | undefined) {
		if (socket.subject || this.#authenticating.has(socket.id)) {
			this.#error(socket.id, 'not_authenticated', 'Already authenticated');
			return;
		}

		this.#authenticating.add(socket.id);

		try {
			const response = await this.#call('session', { token: token ?? null }, socket.cookie);

			if (!this.#store.socket(socket.id)) {
				return;
			}

			if (response.status === 401) {
				const { message } = (response.body ?? {}) as { message?: unknown };

				this.#close(
					socket.id,
					CLOSE.UNAUTHORIZED,
					typeof message === 'string' ? message : 'Invalid or expired token'
				);
				return;
			}

			if (response.status !== 200) {
				console.error(`[realtime] session failed (${response.status})`, response.body);
				this.#close(socket.id, CLOSE.INTERNAL, 'Could not check the token');
				return;
			}

			const { subject, expiresAt } = response.body as SessionResult;

			this.#store.authenticate(socket.id, subject, expiresAt);
			this.#transport.send(socket.id, { type: 'ready', subject: subject.kind, expiresAt });
		} finally {
			this.#authenticating.delete(socket.id);
		}
	}

	async #subscribe(socket: SocketState, message: Extract<ClientMessage, { type: 'subscribe' }>) {
		const { subject } = socket;

		if (!subject) {
			this.#error(socket.id, 'not_authenticated', 'Send `auth` first', message.id);
			return;
		}

		const existing = this.#store.subscriptions(socket.id);

		if (existing.some((subscription) => subscription.id === message.id)) {
			this.#error(socket.id, 'duplicate_id', 'A subscription with this id exists', message.id);
			return;
		}

		if (existing.length >= LIMITS.MAX_SUBSCRIPTIONS) {
			this.#error(
				socket.id,
				'too_many_subscriptions',
				`At most ${LIMITS.MAX_SUBSCRIPTIONS} subscriptions per connection`,
				message.id
			);
			return;
		}

		const subscription: Subscription = {
			id: message.id,
			record: message.record ?? null,
			filter: message.where ?? null,
			fields: message.select ?? null,
			expand: message.include ?? null
		};
		const response = await this.#call('subscribe', {
			collection: this.collection,
			subject,
			record: subscription.record,
			filter: subscription.filter,
			fields: subscription.fields,
			expand: subscription.expand
		});

		if (!this.#store.socket(socket.id)) {
			return;
		}

		if (response.status !== 200) {
			const refusal = response.body as Partial<SubscribeRefusal> | null;

			if (response.status >= 500 || !refusal?.code) {
				console.error(`[realtime] subscribe failed (${response.status})`, response.body);
			}

			this.#error(
				socket.id,
				response.status < 500 && refusal?.code ? refusal.code : 'server_error',
				refusal?.message ?? 'Could not check the subscription',
				message.id
			);
			return;
		}

		// Checked again: the same id may have been subscribed while this one was checked.
		if (this.#store.subscriptions(socket.id).some((other) => other.id === message.id)) {
			this.#error(socket.id, 'duplicate_id', 'A subscription with this id exists', message.id);
			return;
		}

		this.#store.addSubscription(socket.id, subscription);
		this.#transport.send(socket.id, { type: 'subscribed', id: message.id });
	}

	async #call(path: InternalPath, body: unknown, cookie?: string | null) {
		try {
			return await this.#internal(path, body, cookie);
		} catch (error) {
			return {
				status: 500,
				body: { message: error instanceof Error ? error.message : String(error) }
			};
		}
	}

	#invalid(id: string, message: string) {
		const strikes = (this.#strikes.get(id) ?? 0) + 1;

		this.#strikes.set(id, strikes);

		if (strikes >= LIMITS.MAX_STRIKES) {
			this.#close(id, CLOSE.PROTOCOL_ERROR, 'Too many invalid messages');
			return;
		}

		this.#error(id, 'invalid_message', message);
	}

	#error(socketId: string, code: RealtimeErrorCode, message: string, id?: string) {
		this.#transport.send(socketId, { type: 'error', id, code, message });
	}

	#close(id: string, code: number, reason: string) {
		this.#transport.close(id, code, reason);
		this.closed(id);
	}
}
