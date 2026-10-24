/**
 * The live updates protocol: messages over the WebSocket at `/api/live?collection=<name>`.
 * Mirrors the protocol of the app (`src/lib/realtime/protocol.ts`); keep both in sync.
 */

/** The path of the WebSocket. */
export const LIVE_PATH = '/api/live';

/** What happened to a record. */
export type LiveAction = 'create' | 'update' | 'delete';

/** Who a connection is authenticated as. */
export type LiveSubjectKind = 'admin' | 'user' | 'anonymous';

/** A message from the client to the server. */
export type ClientMessage =
	| { type: 'auth'; token?: string }
	| {
			type: 'subscribe';
			id: string;
			record?: string;
			where?: string;
			select?: string[];
			include?: string[];
	  }
	| { type: 'unsubscribe'; id: string };

/** A message from the server to the client. */
export type ServerMessage =
	| { type: 'ready'; subject: LiveSubjectKind; expiresAt: number | null }
	| { type: 'subscribed'; id: string }
	| { type: 'unsubscribed'; id: string }
	| {
			type: 'event';
			id: string;
			action: LiveAction;
			record: Record<string, unknown>;
			at: number;
	  }
	| { type: 'error'; id?: string; code: LiveErrorCode; message: string }
	| { type: 'pong' };

/** Why the server refused a message or a subscription. */
export type LiveErrorCode =
	| 'invalid_message'
	| 'not_authenticated'
	| 'collection_not_found'
	| 'forbidden'
	| 'invalid_query'
	| 'too_many_subscriptions'
	| 'duplicate_id'
	| 'server_error';

/** Close codes of the WebSocket. */
export const CLOSE = {
	NORMAL: 1000,
	GOING_AWAY: 1001,
	MESSAGE_TOO_BIG: 1009,
	INTERNAL: 1011,
	PROTOCOL_ERROR: 4000,
	AUTH_TIMEOUT: 4001,
	INVALID_COLLECTION: 4004,
	UNAUTHORIZED: 4401
} as const;

/** How often the client pings. */
export const PING_INTERVAL_MS = 30_000;

/** The heartbeat frames. */
export const PING_FRAME = '{"type":"ping"}';
/** The answer to `PING_FRAME`. */
export const PONG_FRAME = '{"type":"pong"}';
