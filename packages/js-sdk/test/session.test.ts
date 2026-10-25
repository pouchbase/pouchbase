import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserStorage, memoryStorage, Pouchbase, Session } from '../src/index.js';
import type { SessionStorage } from '../src/index.js';

/** An unsigned JWT that expires at `exp` (seconds since the epoch), or never without one. */
function token(exp?: number) {
	const payload = btoa(JSON.stringify(exp === undefined ? { sub: 'u1' } : { sub: 'u1', exp }));

	return `eyJhbGciOiJIUzI1NiJ9.${payload.replace(/=+$/, '')}.signature`;
}

const now = () => Math.floor(Date.now() / 1000);

/** A `localStorage` stand-in backed by a map. */
function fakeLocalStorage() {
	const items = new Map<string, string>();

	return {
		items,
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => {
			items.set(key, value);
		},
		removeItem: (key: string) => {
			items.delete(key);
		}
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Session', () => {
	it('starts signed out', () => {
		const session = new Session();

		expect(session.token).toBeNull();
		expect(session.userId).toBeNull();
		expect(session.user).toBeNull();
		expect(session.signedIn).toBe(false);
		expect(session.expiresAt).toBeNull();
	});

	it('begins and ends a session', () => {
		const session = new Session();
		const exp = now() + 60;

		session.begin({ token: token(exp), userId: 'u1' });

		expect(session.token).toBe(token(exp));
		expect(session.userId).toBe('u1');
		expect(session.user).toBeNull();
		expect(session.signedIn).toBe(true);
		expect(session.expiresAt).toEqual(new Date(exp * 1000));

		session.begin({ token: token(exp), userId: 'u1', user: { id: 'u1', name: 'Ada' } });
		expect(session.user).toEqual({ id: 'u1', name: 'Ada' });

		session.end();
		expect(session.token).toBeNull();
		expect(session.signedIn).toBe(false);
	});

	it('is not signed in with an expired token', () => {
		const session = new Session();

		session.begin({ token: token(now() - 60), userId: 'u1' });

		expect(session.token).not.toBeNull();
		expect(session.signedIn).toBe(false);
	});

	it('has no expiry for a token without exp', () => {
		const session = new Session();

		session.begin({ token: token(), userId: 'u1' });

		expect(session.signedIn).toBe(true);
		expect(session.expiresAt).toBeNull();
	});

	it('notifies subscribers until they unsubscribe', () => {
		const session = new Session();
		const listener = vi.fn();
		const unsubscribe = session.subscribe(listener, { immediate: true });

		expect(listener).toHaveBeenLastCalledWith(null);

		session.begin({ token: 'abc', userId: 'u1' });
		expect(listener).toHaveBeenLastCalledWith({ token: 'abc', userId: 'u1', user: null });

		session.end();
		expect(listener).toHaveBeenLastCalledWith(null);

		unsubscribe();
		session.begin({ token: 'def', userId: 'u2' });
		expect(listener).toHaveBeenCalledTimes(3);
	});

	it('loads, persists and forgets through its storage', () => {
		const persisted: unknown[] = [];
		const forget = vi.fn();
		const storage: SessionStorage = {
			load: () => ({ token: 'abc', userId: 'u1', user: null }),
			persist: (session) => {
				persisted.push(session);
			},
			forget
		};
		const session = new Session(storage);

		expect(session.token).toBe('abc');

		session.begin({ token: 'def', userId: 'u2' });
		expect(persisted).toEqual([{ token: 'def', userId: 'u2', user: null }]);

		session.end();
		expect(forget).toHaveBeenCalledOnce();
	});

	it('keeps nothing with memoryStorage()', () => {
		const storage = memoryStorage();

		storage.persist({ token: 'abc', userId: 'u1', user: null });

		expect(storage.load()).toBeNull();
	});
});

describe('browserStorage()', () => {
	it('keeps the session in localStorage across clients', () => {
		const localStorage = fakeLocalStorage();

		vi.stubGlobal('localStorage', localStorage);

		const first = new Pouchbase('https://pouch.example.com', { session: 'browser' });

		first.session.begin({ token: 'abc', userId: 'u1' });
		expect(JSON.parse(localStorage.items.get('pouchbase_session')!)).toEqual({
			token: 'abc',
			userId: 'u1',
			user: null
		});

		const second = new Pouchbase('https://pouch.example.com', { session: 'browser' });

		expect(second.session.token).toBe('abc');
		expect(second.session.userId).toBe('u1');

		second.session.end();
		expect(localStorage.items.has('pouchbase_session')).toBe(false);
	});

	it('uses its own key', () => {
		const localStorage = fakeLocalStorage();

		vi.stubGlobal('localStorage', localStorage);
		new Session(browserStorage('my_app')).begin({ token: 'abc', userId: 'u1' });

		expect([...localStorage.items.keys()]).toEqual(['my_app']);
	});

	it('ignores stored values that are not a session', () => {
		const localStorage = fakeLocalStorage();

		vi.stubGlobal('localStorage', localStorage);

		for (const value of ['not json', '{"token":42}', '{"token":"","userId":"u1"}', 'null']) {
			localStorage.items.set('pouchbase_session', value);
			expect(browserStorage().load()).toBeNull();
		}
	});

	it('keeps nothing without localStorage', () => {
		vi.stubGlobal('localStorage', undefined);

		const storage = browserStorage();

		expect(() => storage.persist({ token: 'abc', userId: 'u1', user: null })).not.toThrow();
		expect(storage.load()).toBeNull();
		expect(() => storage.forget()).not.toThrow();
	});

	it('keeps nothing when localStorage throws', () => {
		const blocked = () => {
			throw new Error('SecurityError');
		};

		vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });

		const session = new Session(browserStorage());

		expect(() => session.begin({ token: 'abc', userId: 'u1' })).not.toThrow();
		expect(session.token).toBe('abc');
		expect(() => session.end()).not.toThrow();
	});
});
