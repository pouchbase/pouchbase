import { snippet } from '#lib/highlight.js';

// The examples use the `posts` and `comments` collections of the platform docs (see Collections).

/* Installation */

export const install = snippet(
	'bash',
	`
pnpm add @pouchbasejs/js-sdk`
);

export const client = snippet(
	'typescript',
	`
import { createClient } from '@pouchbasejs/js-sdk';
import type { Schema } from './pouchbase'; // generated, see TypeScript types

export const pouch = createClient<Schema>('https://pouchbase.example.com', {
	// Keeps users signed in across reloads; the default ('memory') forgets the session on reload
	session: 'browser'
});`
);

export const firstSteps = snippet(
	'typescript',
	`
await pouch.auth.login('ada@example.com', 'correct horse battery staple');

const user = await pouch.auth.me(); // UsersRecord | null
const { items } = await pouch.db.posts.findMany({
	where: { status: 'published' },
	orderBy: { published_at: 'desc' },
	limit: 10
}); // PostsRecord[]`
);

export const otherRequests = snippet(
	'typescript',
	`
// Any API path, with the session's token and the same error handling
const result = await pouch.request<{ status: string }>('/api/health');
await pouch.request('/api/plugins/demo/items', { method: 'POST', body: { title: 'Hi' } });

// An absolute URL, e.g. for a link
pouch.url('/api/files/f9w2e4r6t8y1u3i', { download: 1 });

await pouch.health(); // { status: 'ok' } while the instance serves requests`
);

/* TypeScript types */

export const typesCli = snippet(
	'bash',
	`
npx @pouchbasejs/js-sdk types "https://pouchbase.example.com/api/types?token=…" --out src/pouchbase.ts

# Or with the URL in the environment, e.g. in CI
POUCHBASE_TYPES_URL="https://pouchbase.example.com/api/types?token=…" npx @pouchbasejs/js-sdk types --out src/pouchbase.ts

# Or with an API key of the service scope instead of the token
npx @pouchbasejs/js-sdk types https://pouchbase.example.com --api-key pbk_… --out src/pouchbase.ts`
);

export const typesScript = snippet(
	'json',
	`
{
	"scripts": {
		"types": "pouchbase types --out src/pouchbase.ts"
	}
}`
);

export const typesFile = snippet(
	'typescript',
	`
// src/pouchbase.ts (generated)
export interface PostsRecord {
	/** \`id\` · ID. */
	id: string;
	/** \`title\` · Text, required. */
	title: string;
	status: 'draft' | 'published';
	tags: ('news' | 'release' | 'guide')[];
	author: string | null;
	published_at: string | null;
	created_at: number;
	// …
}

export interface PostsCreate {
	title: string; // required
	status?: 'draft' | 'published';
	published_at?: string | Date | null;
	// … no id, timestamps or computed fields
}

export interface Schema {
	posts: { $record: PostsRecord; $create: PostsCreate; $relations: { author: 'users' } };
	// …
}`
);

export const typedClient = snippet(
	'typescript',
	`
import { createClient } from '@pouchbasejs/js-sdk';
import type { Schema } from './pouchbase';

const pouch = createClient<Schema>('https://pouchbase.example.com');

const post = await pouch.db.posts.find(id); // PostsRecord | null
post?.tags; // ('news' | 'release' | 'guide')[]

await pouch.db.posts.findMany({ where: { satus: 'draft' } }); // type error: no field satus

// A collection that isn't in the schema, untyped
const drafts = await pouch.db.$collection('drafts').findMany();`
);

export const fetchTypes = snippet(
	'typescript',
	`
import { writeFile } from 'node:fs/promises';
import { fetchTypes } from '@pouchbasejs/js-sdk';

const code = await fetchTypes(process.env.POUCHBASE_TYPES_URL!);
await writeFile('src/pouchbase.ts', code);`
);

/* Errors */

export const errors = snippet(
	'typescript',
	`
import { isPouchbaseError } from '@pouchbasejs/js-sdk';

try {
	await pouch.db.posts.insert({ title: '' });
} catch (error) {
	if (isPouchbaseError(error, 'invalid')) {
		error.status; // 400
		error.message; // 'Invalid record'
		error.issues; // { title: 'Required' }
	} else if (isPouchbaseError(error, 'network')) {
		// Offline, or the server couldn't be reached
	} else {
		throw error;
	}
}`
);

export const safe = snippet(
	'typescript',
	`
const result = await pouch.db.posts.insert(values).safe();

if (result.ok) {
	result.data.id; // the new record
} else {
	result.error.kind; // 'invalid', 'forbidden', 'conflict', …
	result.error.issues.title; // typed by the fields of posts
}`
);

/* Authentication */

export const password = snippet(
	'typescript',
	`
import { isPouchbaseError } from '@pouchbasejs/js-sdk';

const { verificationRequired } = await pouch.auth.register({
	name: 'Ada Lovelace',
	email: 'ada@example.com',
	password: 'correct horse battery staple'
});
// verificationRequired: no session yet, Ada signs in after following the link in the email

try {
	await pouch.auth.login('ada@example.com', 'correct horse battery staple');
} catch (error) {
	if (isPouchbaseError(error, 'unauthorized')) {
		// Wrong email or password
	}

	if (isPouchbaseError(error) && error.code === 'email_not_verified') {
		await pouch.auth.sendVerification('ada@example.com'); // send the link again
	}
}

const user = await pouch.auth.me(); // UsersRecord | null
pouch.auth.logout(); // ends the session`
);

export const oauth = snippet(
	'typescript',
	`
// [{ provider: 'github', label: 'GitHub', iconUrl: 'https://…/github.svg?v=1.0.0' }, …]
const providers = await pouch.auth.providers();

button.addEventListener('click', async () => {
	try {
		await pouch.auth.oauth('github');
	} catch (error) {
		// error.code: access_denied, email_in_use, sign_in_failed, popup_blocked, popup_closed or timeout
	}
});

// Outside a browser, e.g. in a desktop app: open the page yourself
await pouch.auth.oauth('github', { open: (url) => openInSystemBrowser(url), timeout: 120_000 });`
);

export const mailLinks = snippet(
	'typescript',
	`
await pouch.auth.sendVerification('ada@example.com');
await pouch.auth.sendPasswordReset('ada@example.com');

// Only when you handle the links in your own app instead of Pouchbase's pages:
await pouch.auth.verifyEmail(token);
await pouch.auth.resetPassword(token, 'a new password');`
);

export const session = snippet(
	'typescript',
	`
pouch.session.signedIn; // true while there is a token that hasn't expired
pouch.session.userId; // string | null
pouch.session.user; // the signed-in user, once known
pouch.session.expiresAt; // Date | null, from the token

// Runs after every sign-in and sign-out; immediate: true also runs it right away
const unsubscribe = pouch.session.subscribe(
	(session) => {
		console.log(session ? \`Signed in as \${session.userId}\` : 'Signed out');
	},
	{ immediate: true }
);
unsubscribe();

// A token you got elsewhere, for example from your own server:
pouch.session.begin({ token, userId });
pouch.session.end(); // the same as pouch.auth.logout()`
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

/* Filters */

export const whereObject = snippet(
	'typescript',
	`
await pouch.db.posts.findMany({
	where: {
		status: 'published', // equals
		views: { gte: 10, lt: 1000 }, // eq, not, in, notIn, gt, gte, lt, lte
		title: { contains: 'svelte' }, // contains, notContains, startsWith, endsWith (any case)
		tags: { has: 'news' }, // multiple fields: has, isEmpty
		cover: { not: null }, // has a cover
		published_at: { lte: new Date() }, // dates compare as dates
		$or: [{ featured: true }, { views: { gt: 500 } }]
	}
});`
);

export const whereCompiled = snippet(
	'bash',
	`
# What the SDK sends as ?where= for the query above
status == "published" and views >= 10 and views < 1000 and contains(title, "svelte")
and any(tags) == "news" and cover != null and published_at <= "2026-10-25T09:30:00.000Z"
and (featured == true or views > 500)`
);

export const conditionTag = snippet(
	'typescript',
	`
import { condition } from '@pouchbasejs/js-sdk';

// Values in \${…} are escaped, so they can come from users
await pouch.db.posts.findMany({
	where: condition\`author == $user.id or contains(title, \${search})\`
});

// Functions of the condition syntax, such as the posts of the last 7 days
await pouch.db.posts.findMany({
	where: condition\`published_at >= date_add(now(), -7, "days")\`
});`
);

/* Files */

export const fileUrls = snippet(
	'typescript',
	`
const post = await pouch.db.posts.findOrThrow(id);

if (post.cover) {
	pouch.files.url(post.cover); // https://pouchbase.example.com/api/files/f9w2e4r6t8y1u3i
	pouch.files.url(post.cover, { size: '400x300' }); // a thumbnail size from the files settings
	pouch.files.url(post.cover, { size: '100x100:fit' }); // fitted, without cropping
	pouch.files.url(post.cover, { download: true }); // always a download
}

// A file record works too, e.g. from include
const withCover = await pouch.db.posts.findOrThrow(id, { include: { cover: true } });

if (withCover.cover) {
	img.src = pouch.files.url(withCover.cover, { size: '400x300' });
}`
);

/* Functions */

export const invoke = snippet(
	'typescript',
	`
// POST /api/functions/hello with a JSON body; the signed-in user's token is sent along
const { message } = await pouch.functions.invoke<{ message: string }>('hello', {
	body: { name: 'Ada' }
});

// Another method, a path below the function and a query string:
// GET /api/functions/orders/42?include=items
const order = await pouch.functions.invoke<Order>('orders', {
	method: 'GET',
	path: '/42',
	query: { include: 'items' }
});`
);

export const invokeErrors = snippet(
	'typescript',
	`
import { isPouchbaseError } from '@pouchbasejs/js-sdk';

try {
	await pouch.functions.invoke('checkout', { body: { plan: 'pro' } });
} catch (error) {
	if (isPouchbaseError(error, 'unauthorized')) {
		// The function requires sign-in
	}

	if (isPouchbaseError(error, 'not_found')) {
		// No function with this name
	}
}`
);

/* API keys */

export const apiKeyClient = snippet(
	'typescript',
	`
import { createClient } from '@pouchbasejs/js-sdk';
import type { Schema } from './pouchbase';

// On a server only, with the key from the environment
const pouch = createClient<Schema>(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_API_KEY });

await pouch.mail.send({ template: 'welcome', to: 'ada@example.com' }); // any key`
);

export const asService = snippet(
	'typescript',
	`
// A key with the service scope also reaches the records API as an admin
const pouch = createClient<Schema>(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_SERVICE_KEY });

// The API rules don't apply to these calls
await pouch.asService().db.posts.patch(id, { featured: true });
const { total } = await pouch.asService().db.users.findMany({ limit: 1 });

// Without asService(), calls act for the session's user (or nobody), as in an app
await pouch.db.posts.findMany();`
);

/* Email */

export const sendMail = snippet(
	'typescript',
	`
import { createClient } from '@pouchbasejs/js-sdk';

interface Env {
	POUCHBASE_URL: string;
	POUCHBASE_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const pouch = createClient(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_API_KEY });

		const { sent } = await pouch.mail.send({
			template: 'welcome',
			to: 'ada@example.com', // or a list of up to 50
			variables: { name: 'Ada', items: [{ title: 'Create a project' }] }
		});

		return Response.json({ sent }); // { sent: 1 }
	}
};`
);

export const mailErrors = snippet(
	'typescript',
	`
import { isPouchbaseError } from '@pouchbasejs/js-sdk';

try {
	await pouch.mail.send({ template: 'welcome', to: 'ada@example.com' });
} catch (error) {
	if (isPouchbaseError(error) && error.status === 422) {
		error.issues; // { 'variables.name': 'Required' }
	}
}`
);

/* Schema */

export const schema = snippet(
	'typescript',
	`
// An API key with the service scope, never in code that runs in a browser
const pouch = createClient(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_SERVICE_KEY });

const posts = await pouch.schema.find('posts'); // CollectionSchema | null
const users = await pouch.schema.find('users');

await pouch.schema.create({
	name: 'comments',
	fields: [
		{ name: 'id', type: 'id', options: { generator: 'random' } },
		{
			name: 'post',
			type: 'relation',
			required: true,
			options: { collectionId: posts!.id, onDelete: 'cascade' }
		},
		{ name: 'author', type: 'relation', options: { collectionId: users!.id } },
		{ name: 'body', type: 'text', required: true },
		{ name: 'created_at', type: 'created' }
	],
	rules: {
		list: '', // everyone
		view: '',
		create: '$user.id != null and author == $user.id',
		update: 'author == $user.id',
		delete: 'author == $user.id'
	}
});`
);

export const schemaChanges = snippet(
	'typescript',
	`
const all = await pouch.schema.list(); // every collection with its fields, indexes and rules

// Only the given parts change; rules keeps the actions you leave out
await pouch.schema.update('comments', { rules: { list: 'author == $user.id' } });

// Changes that remove fields or data need force
await pouch.schema.update('comments', { fields: withoutBody }, { force: true });

await pouch.schema.remove('comments'); // and its records`
);

export const transfer = snippet(
	'typescript',
	`
// Copy the schema to another instance: matched by id, then by name
const file = await pouch.schema.export({ collections: ['posts', 'comments'] });

const { plan } = await other.schema.import(file, { dryRun: true });
plan.steps.map((step) => step.description); // ['Create collection comments', …]

await other.schema.import(file, { force: true }); // force: also changes that remove data`
);
