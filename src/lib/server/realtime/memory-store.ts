import type { HubStore, SocketState, Subject, Subscription } from './hub-core.ts';

import { CLOSE } from '../../realtime/protocol.ts';

/** A `HubStore` in memory: the Node hub's, and the one tests use. */
export class MemoryStore implements HubStore {
	readonly #sockets = new Map<string, SocketState>();
	readonly #subscriptions = new Map<string, Map<string, Subscription>>();

	addSocket(socket: { id: string; cookie: string | null; deadline: number }) {
		this.#sockets.set(socket.id, { ...socket, subject: null, expiresAt: null });
		this.#subscriptions.set(socket.id, new Map());
	}

	socket(id: string) {
		return this.#sockets.get(id) ?? null;
	}

	authenticate(id: string, subject: Subject, expiresAt: number | null) {
		const socket = this.#sockets.get(id);

		if (socket) {
			this.#sockets.set(id, { ...socket, subject, expiresAt, deadline: null });
		}
	}

	removeSocket(id: string) {
		this.#sockets.delete(id);
		this.#subscriptions.delete(id);
	}

	subscriptions(socketId: string) {
		return [...(this.#subscriptions.get(socketId)?.values() ?? [])];
	}

	addSubscription(socketId: string, subscription: Subscription) {
		this.#subscriptions.get(socketId)?.set(subscription.id, subscription);
	}

	removeSubscription(socketId: string, id: string) {
		this.#subscriptions.get(socketId)?.delete(id);
	}

	subscribers(recordId: string) {
		const found: { socketId: string; subject: Subject; subscription: Subscription }[] = [];

		for (const [socketId, subscriptions] of this.#subscriptions) {
			const subject = this.#sockets.get(socketId)?.subject;

			if (!subject) {
				continue;
			}

			for (const subscription of subscriptions.values()) {
				if (subscription.record === null || subscription.record === recordId) {
					found.push({ socketId, subject, subscription });
				}
			}
		}

		return found;
	}

	due(now: number) {
		const found: { id: string; code: number; reason: string }[] = [];

		for (const socket of this.#sockets.values()) {
			if (socket.deadline !== null && socket.deadline <= now) {
				found.push({ id: socket.id, code: CLOSE.AUTH_TIMEOUT, reason: 'No auth message' });
			} else if (socket.expiresAt !== null && socket.expiresAt <= now) {
				found.push({ id: socket.id, code: CLOSE.UNAUTHORIZED, reason: 'Token expired' });
			}
		}

		return found;
	}

	nextWake() {
		let next: number | null = null;

		for (const socket of this.#sockets.values()) {
			for (const time of [socket.deadline, socket.expiresAt]) {
				if (time !== null && (next === null || time < next)) {
					next = time;
				}
			}
		}

		return next;
	}
}
