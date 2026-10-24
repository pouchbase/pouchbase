import { snippet } from '#lib/highlight.js';

export const client = snippet(
	'typescript',
	`
import { createClient } from '@pouchbasejs/js-sdk';
import type { Schema } from './pouchbase'; // generated, see Collections and records

export const pouch = createClient<Schema>('https://pouchbase.example.com', {
	// Keeps users signed in across reloads; the default ('memory') forgets the session on reload.
	session: 'browser'
});`
);

export const password = snippet(
	'typescript',
	`
import { isPouchbaseError } from '@pouchbasejs/js-sdk';

const { verificationRequired } = await pouch.auth.signUp({
	name: 'Ada Lovelace',
	email: 'ada@example.com',
	password: 'correct horse battery staple'
});
// verificationRequired: no session yet, Ada signs in after following the link in the email

try {
	await pouch.auth.signIn('ada@example.com', 'correct horse battery staple');
} catch (error) {
	if (isPouchbaseError(error, 'unauthorized')) {
		// Wrong email or password.
	}

	if (isPouchbaseError(error) && error.code === 'email_not_verified') {
		await pouch.auth.sendVerification('ada@example.com'); // send the link again
	}
}

const user = await pouch.auth.me(); // UsersRecord | null
pouch.auth.signOut(); // ends the session`
);

export const session = snippet(
	'typescript',
	`
pouch.session.signedIn; // true while there is a token that hasn't expired
pouch.session.userId; // string | null
pouch.session.user; // the signed-in user, once known
pouch.session.expiresAt; // Date | null, from the token

// Runs after every sign-in and sign-out; immediate: true also runs it right away.
const stop = pouch.session.watch(
	(session) => {
		console.log(session ? \`Signed in as \${session.userId}\` : 'Signed out');
	},
	{ immediate: true }
);
stop();

// A token you got elsewhere, for example from your own server:
pouch.session.begin({ token, userId });
pouch.session.end(); // the same as pouch.auth.signOut()`
);

export const storage = snippet(
	'typescript',
	`
import { browserStorage, createClient, type SessionStorage } from '@pouchbasejs/js-sdk';

// localStorage under your own key (the default key is pouchbase_session):
const pouch = createClient<Schema>(url, { session: browserStorage('my_app_session') });

// Or keep the session wherever you like:
const cookieStorage: SessionStorage = {
	load: () => readSessionCookie(), // SessionData | null
	persist: (session) => writeSessionCookie(session), // { token, userId, user }
	forget: () => clearSessionCookie()
};

const pouchWithCookies = createClient<Schema>(url, { session: cookieStorage });`
);

export const oauth = snippet(
	'typescript',
	`
// [{ provider: 'github', label: 'GitHub', iconUrl: 'https://…/github.svg?v=1.0.0' }, …]
const providers = await pouch.auth.providers();

button.addEventListener('click', async () => {
	try {
		await pouch.auth.signInWithOAuth('github');
	} catch (error) {
		// error.code: access_denied, email_in_use, sign_in_failed, popup_blocked, popup_closed or timeout
	}
});`
);

export const mail = snippet(
	'typescript',
	`
await pouch.auth.sendVerification('ada@example.com');
await pouch.auth.sendPasswordReset('ada@example.com');

// Only needed when you handle the links in your own app instead of Pouchbase's pages:
await pouch.auth.verifyEmail(token);
await pouch.auth.resetPassword(token, 'a new password');`
);
