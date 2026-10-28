import type { PouchbaseClient } from '../client.js';
import type { PouchbaseError } from '../error.js';
import { compileInclude, compileSelect, compileWhere } from '../query.js';
import type { Condition, FieldName, Selected, Where } from '../query.js';
import { RealtimeConnection } from '../realtime/connection.js';
import type {
	ConnectionState,
	RealtimeEvent,
	RealtimeSubscription,
	WebSocketLike
} from '../realtime/connection.js';
import { REALTIME_PATH } from '../realtime/protocol.js';
import type {
	AnyInclude,
	AnyRecord,
	AnyRelations,
	Include,
	Included,
	RecordOf,
	RelationsOf
} from './db.js';
import type { DefaultCollections } from '../types.js';

/**
 * Options for `pouch.realtime.subscribe()`, typed by the record `R`. `S` is the `select` and `I` the
 * `include` passed; `H` is every `include` the collection allows (`Include`), for the editor's
 * completions.
 */
export type SubscribeOptions<
	R = AnyRecord,
	S = readonly string[] | undefined,
	I = AnyInclude | undefined,
	H = never
> = {
	/** Only changes to records that match, after the change (and before it, for deletes). */
	where?: Where<R> | Condition;
	/** Only these fields of each record; the event type has only them too. */
	select?: S;
	/**
	 * Relations to send as records instead of ids, as in `pouch.db.<name>.find()`; related records
	 * the view rule of their collection hides are left out (`null`).
	 */
	include?: I | NoInfer<H>;
	/** Called when the subscription fails, now or after a reconnect (see `ready`). */
	onError?: (error: PouchbaseError) => void;
};

/**
 * What `pouch.realtime.subscribe()` listens to: a collection of the schema `C` (`'posts'`) or one
 * record of it (`'posts/<id>'`).
 */
export type Topic<C> = (keyof C & string) | `${keyof C & string}/${string}`;

/** The collection of a topic: `'posts'` for `'posts'` and `'posts/<id>'`. */
export type TopicCollection<T extends string> = T extends `${infer N}/${string}` ? N : T;

/** Whether the collection of topic `T` is in the schema `C`. */
type Typed<C, T extends string> = string extends T
	? false
	: TopicCollection<T> extends keyof C
		? true
		: false;

/** The record of the collection of topic `T`; `AnyRecord` for a collection not in the schema. */
export type TopicRecord<C, T extends string> =
	Typed<C, T> extends true ? RecordOf<C[TopicCollection<T> & keyof C]> : AnyRecord;

/** The relations of the collection of topic `T` (see `RelationsOf`). */
export type TopicRelations<C, T extends string> =
	Typed<C, T> extends true ? RelationsOf<C[TopicCollection<T> & keyof C]> : AnyRelations;

/** The record of an event of topic `T`, with the `select` `S` and the `include` `I`. */
export type TopicOutput<C, T extends string, S, I> = Included<
	TopicRecord<C, T>,
	Selected<TopicRecord<C, T>, S>,
	C,
	TopicRelations<C, T>,
	I
>;

/**
 * Changes to records as they happen, over a WebSocket (`/api/realtime`): every create, update and
 * delete that the collection's view rule lets the caller see. One connection per collection, opened
 * by the first `subscribe()` and closed after the last `unsubscribe()`; it reconnects by itself and
 * follows sign-ins and sign-outs of `pouch.session`.
 *
 * ```ts
 * const subscription = pouch.realtime.subscribe('posts', (event) => {
 * 	console.log(event.action, event.record);
 * });
 * await subscription.ready;
 * subscription.unsubscribe();
 * ```
 *
 * Topics, `where`, `select`, `include` and the events are typed by the schema `C`, as in
 * `pouch.db.<name>.subscribe()`; collections that aren't in it are untyped.
 */
export class RealtimeService<C extends object = DefaultCollections> {
	readonly #pouch: PouchbaseClient;
	readonly #token: () => string;
	readonly #webSocket?: WebSocketLike;
	readonly #connections = new Map<string, RealtimeConnection>();
	readonly #listeners = new Set<(collection: string, state: ConnectionState) => void>();

	/**
	 * @param token What the connections authenticate with: the client's API key, the session's
	 *   token, or `''` for an anonymous connection.
	 */
	constructor(pouch: PouchbaseClient, token: () => string, webSocket?: WebSocketLike) {
		this.#pouch = pouch;
		this.#token = token;
		this.#webSocket = webSocket;

		pouch.session.subscribe(() => {
			for (const connection of this.#connections.values()) {
				connection.tokenChanged();
			}
		});
	}

	/**
	 * Calls `callback` with every change to the records of `topic`: a collection (`'posts'`) or one
	 * record of it (`'posts/<id>'`).
	 *
	 * ```ts
	 * pouch.realtime.subscribe('posts', (event) => console.log(event.record.title), {
	 * 	where: { status: 'published' },
	 * 	select: ['id', 'title']
	 * });
	 * ```
	 */
	subscribe<
		const T extends Topic<C> | (string & {}),
		const S extends readonly FieldName<TopicRecord<C, T>>[] | undefined = undefined,
		const I extends Include<C, TopicRelations<C, T>> | undefined = undefined
	>(
		topic: T,
		callback: (event: RealtimeEvent<TopicOutput<C, T, S, I>>) => void,
		options: SubscribeOptions<TopicRecord<C, T>, S, I, Include<C, TopicRelations<C, T>>> = {}
	): RealtimeSubscription {
		const separator = topic.indexOf('/');
		const collection = separator === -1 ? topic : topic.slice(0, separator);
		const record = separator === -1 ? undefined : topic.slice(separator + 1);

		return this.#connection(collection).subscribe(
			{
				record: record || undefined,
				where: compileWhere(options.where as Where<AnyRecord> | Condition | undefined) || undefined,
				select: compileSelect(options.select as readonly string[] | undefined)?.split(','),
				include: compileInclude(options.include as AnyInclude | undefined)?.split(',')
			},
			callback as (event: RealtimeEvent) => void,
			options.onError
		);
	}

	/**
	 * Calls `listener` when a connection opens, closes or reconnects, e.g. for a connection indicator.
	 * @returns A function that removes the listener.
	 */
	onState(listener: (collection: string, state: ConnectionState) => void): () => void {
		this.#listeners.add(listener);

		return () => {
			this.#listeners.delete(listener);
		};
	}

	/** Closes every connection and ends every subscription. */
	disconnect(): void {
		for (const connection of this.#connections.values()) {
			connection.close();
		}

		this.#connections.clear();
	}

	#connection(collection: string) {
		let connection = this.#connections.get(collection);

		if (!connection) {
			const url = new URL(this.#pouch.url(REALTIME_PATH, { collection }));

			url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
			connection = new RealtimeConnection({
				url: url.toString(),
				token: this.#token,
				webSocket: this.#webSocket,
				onState: (state) => {
					for (const listener of this.#listeners) {
						listener(collection, state);
					}
				}
			});
			this.#connections.set(collection, connection);
		}

		return connection;
	}
}
