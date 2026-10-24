import type { Pouchbase } from '../client.js';
import type { PouchbaseError } from '../error.js';
import { compileInclude, compileSelect, compileWhere } from '../query.js';
import type { Condition, Where } from '../query.js';
import { LiveConnection } from '../live/connection.js';
import type {
	ConnectionState,
	LiveEvent,
	LiveSubscription,
	WebSocketLike
} from '../live/connection.js';
import { LIVE_PATH } from '../live/protocol.js';
import type { AnyInclude } from './db.js';

/** Options for `pouch.live.watch()`. */
export type WatchOptions<R = Record<string, unknown>> = {
	/** Only changes to records that match, after the change (and before it, for deletes). */
	where?: Where<R> | Condition;
	/** Only these fields of each record. */
	select?: readonly string[];
	/**
	 * Relations to send as records instead of ids, as in `pouch.db.<name>.find()`; related records
	 * the view rule of their collection hides are left out (`null`).
	 */
	include?: AnyInclude;
	/** Called when watching fails, now or after a reconnect (see `ready`). */
	onError?: (error: PouchbaseError) => void;
};

/**
 * Live changes to records over a WebSocket (`/api/live`): every create, update and delete that the
 * collection's view rule lets the caller see. One connection per collection, opened by the first
 * `watch()` and closed after the last one stops; it reconnects by itself and follows sign-ins and
 * sign-outs of `pouch.session`.
 *
 * ```ts
 * const watching = pouch.live.watch('posts', (event) => {
 * 	console.log(event.action, event.record);
 * });
 * await watching.ready;
 * watching.stop();
 * ```
 *
 * `pouch.db.<name>.watch()` does the same, typed by the schema.
 */
export class LiveService {
	readonly #pouch: Pouchbase<object>;
	readonly #webSocket?: WebSocketLike;
	readonly #connections = new Map<string, LiveConnection>();
	readonly #listeners = new Set<(collection: string, state: ConnectionState) => void>();

	constructor(pouch: Pouchbase<object>, webSocket?: WebSocketLike) {
		this.#pouch = pouch;
		this.#webSocket = webSocket;

		pouch.session.watch(() => {
			for (const connection of this.#connections.values()) {
				connection.tokenChanged();
			}
		});
	}

	/**
	 * Calls `callback` with every change to the records of `topic`: a collection (`'posts'`) or one
	 * record of it (`'posts/<id>'`).
	 */
	watch<R = Record<string, unknown>>(
		topic: string,
		callback: (event: LiveEvent<R>) => void,
		options: WatchOptions<R> = {}
	): LiveSubscription {
		const separator = topic.indexOf('/');
		const collection = separator === -1 ? topic : topic.slice(0, separator);
		const record = separator === -1 ? undefined : topic.slice(separator + 1);

		return this.#connection(collection).subscribe(
			{
				record: record || undefined,
				where: compileWhere(options.where) || undefined,
				select: compileSelect(options.select)?.split(','),
				include: compileInclude(options.include)?.split(',')
			},
			callback as (event: LiveEvent) => void,
			options.onError
		);
	}

	/**
	 * Calls `listener` when a connection opens, closes or reconnects, e.g. for a "live" indicator.
	 * @returns A function that removes the listener.
	 */
	onState(listener: (collection: string, state: ConnectionState) => void): () => void {
		this.#listeners.add(listener);

		return () => {
			this.#listeners.delete(listener);
		};
	}

	/** Closes every connection and stops everything that was watched. */
	disconnect(): void {
		for (const connection of this.#connections.values()) {
			connection.close();
		}

		this.#connections.clear();
	}

	#connection(collection: string) {
		let connection = this.#connections.get(collection);

		if (!connection) {
			const url = new URL(this.#pouch.url(LIVE_PATH, { collection }));

			url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
			connection = new LiveConnection({
				url: url.toString(),
				token: () => this.#pouch.session.token ?? '',
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
