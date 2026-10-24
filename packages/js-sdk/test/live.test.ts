import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { condition, Pouchbase, PouchbaseError } from '../src/index.js';
import type { WebSocketInstance } from '../src/index.js';

/** A WebSocket that records what is sent; tests play the server with `receive()`. */
class FakeSocket implements WebSocketInstance {
	static sockets: FakeSocket[] = [];

	readonly url: string;
	readyState = 0;
	sent: string[] = [];
	closedWith: number | undefined;
	onopen: ((event: unknown) => void) | null = null;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	onclose: ((event: { code: number; reason: string }) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;

	constructor(url: string) {
		this.url = url;
		FakeSocket.sockets.push(this);
	}

	open() {
		this.readyState = 1;
		this.onopen?.({});
	}

	receive(message: object) {
		this.onmessage?.({ data: JSON.stringify(message) });
	}

	serverClose(code: number, reason = '') {
		this.readyState = 3;
		this.onclose?.({ code, reason });
	}

	send(data: string) {
		this.sent.push(data);
	}

	close(code?: number) {
		this.readyState = 3;
		this.closedWith = code;
	}

	messages() {
		return this.sent.map((data) => JSON.parse(data) as Record<string, unknown>);
	}
}

const last = () => FakeSocket.sockets.at(-1)!;

function client(token = '') {
	const pouch = new Pouchbase('https://pouch.example.com/', { webSocket: FakeSocket });

	if (token) {
		pouch.session.begin({ token, userId: 'ada' });
	}

	return pouch;
}

beforeEach(() => {
	FakeSocket.sockets = [];
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('pouch.live', () => {
	it('connects per collection, authenticates and subscribes once ready', async () => {
		const pouch = client('token-1');
		const events: unknown[] = [];
		const subscription = pouch.live.watch('posts/p1', (event) => events.push(event), {
			where: condition`views > ${10}`,
			select: ['id', 'title']
		});
		const socket = last();

		expect(socket.url).toBe('wss://pouch.example.com/api/live?collection=posts');

		socket.open();
		expect(socket.messages()).toEqual([{ type: 'auth', token: 'token-1' }]);

		socket.receive({ type: 'ready', subject: 'user', expiresAt: null });
		expect(socket.messages()[1]).toEqual({
			type: 'subscribe',
			id: 's1',
			record: 'p1',
			where: 'views > 10',
			select: ['id', 'title']
		});

		socket.receive({ type: 'subscribed', id: 's1' });
		await expect(subscription.ready).resolves.toBeUndefined();

		socket.receive({ type: 'event', id: 's1', action: 'update', record: { id: 'p1' }, at: 5 });
		expect(events).toEqual([{ action: 'update', record: { id: 'p1' }, at: 5 }]);
	});

	it('sends where objects and include', () => {
		const pouch = client();

		pouch.db.$collection<{ id: string; status: string }>('posts').watch(() => {}, {
			where: { status: 'published' },
			include: { author: true, comments: { include: { author: true } } }
		});
		last().open();
		last().receive({ type: 'ready', subject: 'anonymous', expiresAt: null });

		expect(last().messages()[1]).toEqual({
			type: 'subscribe',
			id: 's1',
			where: 'status == "published"',
			include: ['author', 'comments.author']
		});
	});

	it('shares one connection per collection and closes it after the last one stops', () => {
		const pouch = client();
		const first = pouch.live.watch('posts', () => undefined);
		const second = pouch.db.$collection('posts').watch(() => undefined, { id: 'p2' });
		const socket = last();

		pouch.live.watch('comments', () => undefined);
		expect(FakeSocket.sockets).toHaveLength(2);

		socket.open();
		expect(socket.messages()[0]).toEqual({ type: 'auth' });
		socket.receive({ type: 'ready', subject: 'anonymous', expiresAt: null });
		expect(socket.messages().slice(1)).toEqual([
			{ type: 'subscribe', id: 's1' },
			{ type: 'subscribe', id: 's2', record: 'p2' }
		]);

		first.stop();
		expect(socket.messages().at(-1)).toEqual({ type: 'unsubscribe', id: 's1' });
		second.stop();
		expect(socket.closedWith).toBe(1000);
	});

	it('rejects `ready` and calls `onError` with the server’s refusal', async () => {
		const pouch = client();
		const onError = vi.fn();
		const subscription = pouch.live.watch('posts', () => undefined, { onError });
		const socket = last();

		socket.open();
		socket.receive({ type: 'ready', subject: 'anonymous', expiresAt: null });
		socket.receive({
			type: 'error',
			id: 's1',
			code: 'forbidden',
			message: "The collection's view rule doesn't allow this"
		});

		const error = await subscription.ready.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(PouchbaseError);
		expect(error).toMatchObject({ kind: 'forbidden', code: 'forbidden' });
		expect(onError).toHaveBeenCalledWith(error);
	});

	it('reconnects with a delay and subscribes again', () => {
		const pouch = client();

		pouch.live.watch('posts', () => undefined);

		const socket = last();

		socket.open();
		socket.receive({ type: 'ready', subject: 'anonymous', expiresAt: null });
		socket.receive({ type: 'subscribed', id: 's1' });
		socket.serverClose(1001, 'Server shutting down');
		expect(FakeSocket.sockets).toHaveLength(1);

		vi.advanceTimersByTime(1000);

		const again = last();

		expect(FakeSocket.sockets).toHaveLength(2);
		again.open();
		again.receive({ type: 'ready', subject: 'anonymous', expiresAt: null });
		expect(again.messages()).toEqual([{ type: 'auth' }, { type: 'subscribe', id: 's1' }]);
	});

	it('waits for a new token after an unauthorized close, and reconnects on sign-in', () => {
		const pouch = client('old');

		pouch.live.watch('posts', () => undefined);

		const socket = last();

		socket.open();
		socket.receive({ type: 'ready', subject: 'user', expiresAt: null });
		socket.receive({ type: 'subscribed', id: 's1' });
		socket.serverClose(4401, 'Token expired');
		vi.advanceTimersByTime(60_000);
		expect(FakeSocket.sockets).toHaveLength(1);

		pouch.session.begin({ token: 'new', userId: 'ada' });
		expect(FakeSocket.sockets).toHaveLength(2);
		last().open();
		expect(last().messages()).toEqual([{ type: 'auth', token: 'new' }]);
	});

	it('reconnects when the token changes on an open connection', () => {
		const pouch = client('old');

		pouch.live.watch('posts', () => undefined);
		last().open();
		pouch.session.end();

		expect(FakeSocket.sockets[0]?.closedWith).toBe(1000);
		expect(FakeSocket.sockets).toHaveLength(2);
		last().open();
		expect(last().messages()).toEqual([{ type: 'auth' }]);
	});

	it('pings and reconnects when no answer comes', () => {
		const pouch = client();

		pouch.live.watch('posts', () => undefined);

		const socket = last();

		socket.open();
		vi.advanceTimersByTime(30_000);
		expect(socket.sent.at(-1)).toBe('{"type":"ping"}');

		vi.advanceTimersByTime(10_000);
		expect(socket.closedWith).toBe(1000);

		vi.advanceTimersByTime(1000);
		expect(FakeSocket.sockets).toHaveLength(2);
	});
});
