import { createClient } from '@pouchbasejs/js-sdk';
import type { SessionData } from '@pouchbasejs/js-sdk';

const URL_KEY = 'pouchbase_test_url';

/** The instance to test against: the one picked in the header, else `VITE_POUCHBASE_URL`. */
export const baseUrl =
	readStoredUrl() ?? import.meta.env.VITE_POUCHBASE_URL ?? 'http://localhost:4300';

/** The SDK client every page uses; the app is client-side only (`ssr = false`). */
export const pouch = createClient(baseUrl, { session: 'browser' });

/** The session as reactive state, for the header and the auth page. */
export const auth = $state<{ session: SessionData | null }>({ session: null });

pouch.session.subscribe(
	(session) => {
		auth.session = session;
	},
	{ immediate: true }
);

/** Saves another instance URL and reloads, so every page starts with a fresh client. */
export function switchInstance(url: string) {
	localStorage.setItem(URL_KEY, url.trim());
	location.reload();
}

/** Forgets the picked instance URL and falls back to `VITE_POUCHBASE_URL`. */
export function resetInstance() {
	localStorage.removeItem(URL_KEY);
	location.reload();
}

function readStoredUrl() {
	try {
		return localStorage.getItem(URL_KEY) || null;
	} catch {
		return null;
	}
}
