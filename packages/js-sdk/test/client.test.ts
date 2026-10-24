import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
	condition,
	createClient,
	Pouchbase,
	PouchbaseError,
	fetchTypes,
	isPouchbaseError,
	isTokenValid
} from '../src/index.js';
import type { SessionStorage } from '../src/index.js';
import type { JsonValue, KnownOAuthProvider, OAuthProvider, Page, User } from '../src/index.js';
import { compileOrderBy, compileWhere } from '../src/query.js';

type Call = { url: string; init: RequestInit };

/** A `fetch` that answers with the given responses in order and records every call. */
function mockFetch(...responses: [status: number, body?: unknown][]) {
	const calls: Call[] = [];
	const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
		calls.push({ url: String(input), init });

		const [status, body] = responses.shift() ?? [500, { message: 'No more responses' }];

		return new Response(body === undefined ? null : JSON.stringify(body), {
			status,
			headers: { 'Content-Type': 'application/json' }
		});
	});

	return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

/** An unsigned JWT that expires `seconds` from now. */
function token(seconds: number) {
	const payload = btoa(JSON.stringify({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + seconds }));

	return `eyJhbGciOiJIUzI1NiJ9.${payload.replace(/=+$/, '')}.signature`;
}

/** A storage that starts with a session of `tokenValue`. */
function signedIn(tokenValue: string): SessionStorage {
	return {
		load: () => ({ token: tokenValue, userId: 'u1', user: null }),
		persist: () => undefined,
		forget: () => undefined
	};
}

describe('Pouchbase', () => {
	it('builds URLs without double slashes', () => {
		const pouch = new Pouchbase('https://pouch.example.com/');

		expect(pouch.url('/api/health')).toBe('https://pouch.example.com/api/health');
		expect(pouch.url('api/health', { a: 1, b: undefined })).toBe(
			'https://pouch.example.com/api/health?a=1'
		);
	});

	it('throws a PouchbaseError with the message and issues of the API', async () => {
		const { fetch } = mockFetch([
			409,
			{ message: 'Invalid input', issues: { email: 'This email address is already in use' } }
		]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		const error = await pouch.auth
			.signUp({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'secret' })
			.catch((e) => e);

		expect(error).toBeInstanceOf(PouchbaseError);
		expect(error.status).toBe(409);
		expect(error.message).toBe('Invalid input');
		expect(error.issues).toEqual({ email: 'This email address is already in use' });
	});

	it('wraps network errors', async () => {
		const fetch = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		const error = await pouch.health().catch((e) => e);

		expect(error).toBeInstanceOf(PouchbaseError);
		expect(error.status).toBe(0);
	});

	it('sends the API key instead of the token from a service client', async () => {
		const { fetch, calls } = mockFetch([200, { id: 'p1', title: 'Hi' }]);
		const pouch = new Pouchbase('https://pouch.example.com', {
			fetch,
			apiKey: 'pbk_secret',
			session: signedIn(token(60))
		});

		await pouch.asService().db.$collection('posts').patch('p1', { title: 'Hi' });

		expect(new Headers(calls[0]!.init.headers).get('Authorization')).toBe('Bearer pbk_secret');
		expect(() => new Pouchbase('https://pouch.example.com').asService()).toThrow(PouchbaseError);
	});
});

describe('auth', () => {
	it('lists the enabled providers, including ones from plugins', async () => {
		const providers = [
			{
				provider: 'google',
				label: 'Google',
				iconUrl: 'https://pouch.example.com/api/plugins/auth-google/assets/ui/google.svg?v=1.0.0'
			},
			{ provider: 'gitlab', label: 'GitLab', iconUrl: null }
		];
		const { fetch, calls } = mockFetch([200, providers]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });

		const result = await pouch.auth.providers();

		expect(result).toEqual(providers);
		expect(calls[0]?.url).toBe('https://pouch.example.com/api/auth/providers');
		expectTypeOf(result[0]!.iconUrl).toEqualTypeOf<string | null>();
		expectTypeOf<'gitlab'>().toExtend<OAuthProvider>();
		expectTypeOf<KnownOAuthProvider>().toEqualTypeOf<
			'google' | 'github' | 'microsoft' | 'discord' | 'twitch'
		>();
	});

	it('signs in and stores the token', async () => {
		const { fetch, calls } = mockFetch([200, { token: 'abc', user_id: 'u1' }]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		const listener = vi.fn();

		pouch.session.watch(listener);

		await expect(pouch.auth.signIn('ada@example.com', 'secret')).resolves.toEqual({
			token: 'abc',
			userId: 'u1'
		});
		expect(calls[0]?.url).toBe('https://pouch.example.com/api/auth/password/sign-in');
		expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
			email: 'ada@example.com',
			password: 'secret'
		});
		expect(pouch.session.token).toBe('abc');
		expect(pouch.session.userId).toBe('u1');
		expect(listener).toHaveBeenCalledWith({ token: 'abc', userId: 'u1', user: null });
	});

	it('gives the code of an unverified sign-in', async () => {
		const { fetch } = mockFetch([
			403,
			{ message: 'Verify your email address first', code: 'email_not_verified' }
		]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		const error = await pouch.auth.signIn('ada@example.com', 'secret').catch((e) => e);

		expect(error).toBeInstanceOf(PouchbaseError);
		expect(error.status).toBe(403);
		expect(error.code).toBe('email_not_verified');
	});

	it('signs up and stores the token', async () => {
		const { fetch, calls } = mockFetch([
			200,
			{ token: 'abc', user_id: 'u1', verification_required: false }
		]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		const input = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'secret' };

		await expect(pouch.auth.signUp(input)).resolves.toEqual({
			token: 'abc',
			userId: 'u1',
			verificationRequired: false
		});
		expect(JSON.parse(String(calls[0]?.init.body))).toEqual(input);
		expect(pouch.session.token).toBe('abc');
	});

	it('signs up without signing in when verification is required', async () => {
		const { fetch } = mockFetch([200, { token: null, user_id: 'u1', verification_required: true }]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });

		await expect(
			pouch.auth.signUp({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'secret' })
		).resolves.toEqual({ token: null, userId: 'u1', verificationRequired: true });
		expect(pouch.session.token).toBeNull();
	});

	it('sends the token to /api/auth/me and keeps the user', async () => {
		const { fetch, calls } = mockFetch([200, { id: 'u1', name: 'Ada Lovelace' }]);
		const pouch = new Pouchbase('https://pouch.example.com', {
			fetch,
			session: signedIn('abc')
		});

		await expect(pouch.auth.me()).resolves.toEqual({ id: 'u1', name: 'Ada Lovelace' });
		expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe('Bearer abc');
		expect(pouch.session.user).toEqual({ id: 'u1', name: 'Ada Lovelace' });
	});

	it('ends the session when /api/auth/me rejects the token', async () => {
		const { fetch } = mockFetch([401, { message: 'Invalid or expired token' }]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch, session: signedIn('abc') });

		await expect(pouch.auth.me()).resolves.toBeNull();
		expect(pouch.session.token).toBeNull();
	});

	it('ends the session on sign-out', () => {
		const pouch = new Pouchbase('https://pouch.example.com', { session: signedIn('abc') });
		const listener = vi.fn();

		pouch.session.watch(listener);
		pouch.auth.signOut();

		expect(pouch.session.token).toBeNull();
		expect(listener).toHaveBeenCalledWith(null);
	});

	it('sends password resets and email verifications', async () => {
		const { fetch, calls } = mockFetch([200, {}], [200, {}], [200, {}], [200, {}]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });

		await pouch.auth.sendPasswordReset('ada@example.com');
		await pouch.auth.resetPassword('reset-token', 'new secret');
		await pouch.auth.sendVerification('ada@example.com');
		await pouch.auth.verifyEmail('verify-token');

		expect(
			calls.map((call) => [new URL(call.url).pathname, JSON.parse(String(call.init.body))])
		).toEqual([
			['/api/auth/password/forgot', { email: 'ada@example.com' }],
			['/api/auth/password/reset', { token: 'reset-token', password: 'new secret' }],
			['/api/auth/email/send-verification', { email: 'ada@example.com' }],
			['/api/auth/email/verify', { token: 'verify-token' }]
		]);
	});

	it('returns null from me() without a request when signed out', async () => {
		const { fetch, calls } = mockFetch();
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });

		await expect(pouch.auth.me()).resolves.toBeNull();
		expect(calls).toHaveLength(0);
	});

	it('polls the OAuth result until the sign-in is done', async () => {
		const { fetch, calls } = mockFetch(
			[202, { status: 'pending' }],
			[200, { status: 'done', token: 'abc', user_id: 'u1' }]
		);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		const open = vi.fn();

		await expect(pouch.auth.signInWithOAuth('github', { open, interval: 1 })).resolves.toEqual({
			token: 'abc',
			userId: 'u1'
		});

		const url = new URL(open.mock.calls[0]?.[0]);
		const body = JSON.parse(String(calls[0]?.init.body));

		expect(url.pathname).toBe('/api/auth/oauth2/github');
		expect(url.searchParams.get('challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(body.state).toBe(url.searchParams.get('state'));
		expect(body.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
		expect(pouch.session.token).toBe('abc');
	});

	it('throws the OAuth error code', async () => {
		const { fetch } = mockFetch([200, { status: 'error', error: 'email_in_use' }]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		const error = await pouch.auth
			.signInWithOAuth('google', { open: () => {}, interval: 1 })
			.catch((e) => e);

		expect(error).toBeInstanceOf(PouchbaseError);
		expect(error.code).toBe('email_in_use');
	});
});

describe('files', () => {
	it('builds file URLs', () => {
		const pouch = new Pouchbase('https://pouch.example.com');

		expect(pouch.files.url('abc')).toBe('https://pouch.example.com/api/files/abc');
		expect(pouch.files.url({ id: 'abc' }, { size: '100x100:fit', download: true })).toBe(
			'https://pouch.example.com/api/files/abc?size=100x100%3Afit&download=1'
		);
	});
});

describe('functions', () => {
	it('invokes a function with the token, a JSON body, a path and a query', async () => {
		const { fetch, calls } = mockFetch([200, { message: 'Hello Ada!' }]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		pouch.session.begin({ token: token(60), userId: 'u1' });

		const result = await pouch.functions.invoke<{ message: string }>('hello', {
			body: { name: 'Ada' },
			path: '/greet',
			query: { loud: true }
		});

		expect(result).toEqual({ message: 'Hello Ada!' });
		expect(calls[0]?.url).toBe('https://pouch.example.com/api/functions/hello/greet?loud=true');
		expect(calls[0]?.init.method).toBe('POST');
		expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ name: 'Ada' });
		expect(new Headers(calls[0]?.init.headers).get('authorization')).toMatch(/^Bearer /);
	});

	it('throws the message of a failed function', async () => {
		const { fetch } = mockFetch([401, { message: 'Sign in to call this function' }]);
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		const invoked = pouch.functions.invoke('private');

		await expect(invoked).rejects.toBeInstanceOf(PouchbaseError);
		await expect(invoked).rejects.toMatchObject({
			status: 401,
			message: 'Sign in to call this function'
		});
	});
});

describe('db', () => {
	interface PostsRecord {
		id: string;
		created_at: number;
		title: string;
		status: 'draft' | 'published' | null;
		views: number | null;
		published: boolean;
		tags: string[];
		meta: JsonValue;
		author: string | null;
		comments: string[];
	}

	interface PostsCreate {
		title: string;
		status?: 'draft' | 'published' | null;
		views?: number | null;
		published?: boolean | null;
		tags?: string[] | null;
	}

	interface CommentsRecord {
		id: string;
		body: string;
		author: string;
	}

	type UsersRecord = User & { name: string | null };

	interface Schema {
		users: { $record: UsersRecord; $create: { name?: string | null } };
		posts: {
			$record: PostsRecord;
			$create: PostsCreate;
			$relations: { author: 'users'; comments: 'comments' };
		};
		comments: {
			$record: CommentsRecord;
			$create: { body: string; author: string };
			$relations: { author: 'users' };
		};
	}

	const list = (items: unknown[], offset = 0, total = offset + items.length, limit = 30) => ({
		items,
		total,
		limit,
		offset
	});

	const query = (url: string | undefined) =>
		Object.fromEntries(new URL(url ?? 'https://x').searchParams);

	it('compiles where, orderBy, select, limit and offset into the query', async () => {
		const { fetch, calls } = mockFetch([200, list([{ id: 'p1', title: 'Hi' }], 10, 25, 10)]);
		const pouch = createClient<Schema>('https://pouch.example.com', { fetch });

		const result = await pouch.db.posts.findMany({
			where: {
				status: 'published',
				views: { gte: 10, lt: 100 },
				title: { contains: 'say "hi"' },
				tags: { has: 'news' },
				$or: [{ published: true }, { status: null }]
			},
			orderBy: { created_at: 'desc', title: 'asc' },
			select: ['id', 'title'],
			limit: 10,
			offset: 10
		});

		expect(result).toEqual({
			items: [{ id: 'p1', title: 'Hi' }],
			total: 25,
			limit: 10,
			offset: 10,
			hasMore: true
		});
		expect(new URL(calls[0]!.url).pathname).toBe('/api/db/posts');
		expect(query(calls[0]?.url)).toEqual({
			where:
				'status == "published" and views >= 10 and views < 100 and ' +
				'title contains "say \\"hi\\"" and any(tags) == "news" and ' +
				'(published == true or status == null)',
			order: 'created_at:desc,title:asc',
			select: 'id,title',
			limit: '10',
			offset: '10'
		});
	});

	it('compiles include', async () => {
		const { fetch, calls } = mockFetch([200, { id: 'p1', author: null }], [200, list([])]);
		const pouch = createClient<Schema>('https://pouch.example.com', { fetch });

		await pouch.db.posts.find('p1', {
			select: ['title'],
			include: { author: true, comments: { include: { author: true } } }
		});
		await pouch.db.posts.findMany({ include: { comments: {} } });

		expect(new URL(calls[0]!.url).pathname).toBe('/api/db/posts/p1');
		expect(query(calls[0]?.url)).toEqual({ select: 'title', include: 'author,comments.author' });
		expect(query(calls[1]?.url)).toEqual({ include: 'comments' });
		expect(() =>
			pouch.db.$collection('posts').find('p1', { include: { 'author or 1': true } })
		).toThrow(TypeError);
	});

	it('compiles every comparison', () => {
		expect(
			compileWhere({
				a: { eq: 1, not: 2, gt: 3, gte: 4, lt: 5, lte: 6 },
				b: { contains: 'x', notContains: 'y' },
				c: { eq: null },
				d: { not: null }
			})
		).toBe(
			'a == 1 and a != 2 and a > 3 and a >= 4 and a < 5 and a <= 6 and ' +
				'b contains "x" and b not contains "y" and c == null and d != null'
		);
	});

	it('compiles in, notIn, has, isEmpty and groups', () => {
		expect(compileWhere({ status: { in: ['a', 'b'] }, views: { notIn: [1, 2] } })).toBe(
			'(status == "a" or status == "b") and views != 1 and views != 2'
		);
		expect(compileWhere({ status: { in: [] } })).toBe('1 == 0');
		expect(compileWhere({ editors: { has: 'u1' } })).toBe('any(editors) == "u1"');
		expect(compileWhere({ tags: { isEmpty: true } })).toBe('tags == ""');
		expect(compileWhere({ tags: { isEmpty: false } })).toBe('tags != ""');
		expect(compileWhere({ $or: [] })).toBe('1 == 0');
		expect(compileWhere({ $or: [{}, { a: 1 }] })).toBe('');
		expect(compileWhere({ $and: [{ a: 1 }, { $or: [{ b: true }, { c: 'x' }] }] })).toBe(
			'(a == 1 and (b == true or c == "x"))'
		);
		expect(compileWhere({ created: { gt: new Date(0) } })).toBe(
			'created > "1970-01-01T00:00:00.000Z"'
		);
		expect(compileWhere({})).toBe('');
		expect(() => compileWhere({ a: { like: 'x' } })).toThrow(TypeError);
		expect(() => compileWhere({ a: Number.NaN })).toThrow(TypeError);
	});

	it('refuses field names that could change the condition', () => {
		expect(() => compileWhere({ 'title == "x" or id': 'y' })).toThrow(TypeError);
		expect(() => compileOrderBy({ 'id:desc,x': 'asc' })).toThrow(TypeError);
	});

	it('compiles orderBy with a direction per field', () => {
		expect(compileOrderBy({ created_at: 'desc', title: 'asc' })).toBe('created_at:desc,title:asc');
		expect(compileOrderBy({})).toBe('');
	});

	it('escapes values in hand-written conditions', () => {
		const search = 'a"b\\c';

		expect(
			compileWhere(condition`author == $user.id or title contains ${search} and n > ${5}`)
		).toBe('author == $user.id or title contains "a\\"b\\\\c" and n > 5');
		expect(compileWhere(condition`published == ${true} and deleted == ${null}`)).toBe(
			'published == true and deleted == null'
		);
	});

	it('returns null from find() and findFirst() when nothing is found', async () => {
		const { fetch } = mockFetch([404, { message: 'Record not found' }], [200, list([])]);
		const pouch = createClient<Schema>('https://pouch.example.com', { fetch });

		await expect(pouch.db.posts.find('missing')).resolves.toBeNull();
		await expect(pouch.db.posts.findFirst({ where: { title: 'x' } })).resolves.toBeNull();
	});

	it('still fails when the collection does not exist', async () => {
		const { fetch } = mockFetch([404, { message: 'Collection not found' }]);
		const pouch = createClient('https://pouch.example.com', { fetch });

		await expect(pouch.db.$collection('nope').find('p1')).rejects.toMatchObject({
			kind: 'not_found'
		});
	});

	it('iterates and collects every record', async () => {
		const { fetch, calls } = mockFetch(
			[200, list([{ id: 'a' }, { id: 'b' }], 0, 3, 2)],
			[200, list([{ id: 'c' }], 2, 3, 2)]
		);
		const pouch = createClient<Schema>('https://pouch.example.com', { fetch });

		await expect(pouch.db.posts.findAll({ batchSize: 2 })).resolves.toEqual([
			{ id: 'a' },
			{ id: 'b' },
			{ id: 'c' }
		]);
		expect(calls.map((call) => [query(call.url).limit, query(call.url).offset])).toEqual([
			['2', '0'],
			['2', '2']
		]);
	});

	it('counts records', async () => {
		const { fetch, calls } = mockFetch([200, list([{ id: 'a' }], 0, 42, 1)]);
		const pouch = createClient<Schema>('https://pouch.example.com', { fetch });

		await expect(pouch.db.posts.count({ status: 'draft' })).resolves.toBe(42);
		expect(query(calls[0]?.url)).toMatchObject({ limit: '1', where: 'status == "draft"' });
	});

	it('inserts, patches and removes records with the token', async () => {
		const { fetch, calls } = mockFetch(
			[200, { id: 'p1', title: 'Hello' }],
			[200, { id: 'p1', title: 'Hi' }],
			[204]
		);
		const pouch = createClient<Schema>('https://pouch.example.com', { fetch });
		pouch.session.begin({ token: token(60), userId: 'u1' });

		await expect(pouch.db.posts.insert({ title: 'Hello', published: true })).resolves.toEqual({
			id: 'p1',
			title: 'Hello'
		});
		await pouch.db.posts.patch('p1', { title: 'Hi' }, { select: ['title'] });
		await expect(pouch.db.posts.remove('p1')).resolves.toBeUndefined();

		expect(calls.map((call) => [call.init.method, new URL(call.url).pathname])).toEqual([
			['POST', '/api/db/posts'],
			['PATCH', '/api/db/posts/p1'],
			['DELETE', '/api/db/posts/p1']
		]);
		expect(query(calls[1]?.url)).toEqual({ select: 'title' });
		expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ title: 'Hello', published: true });
		expect(new Headers(calls[0]?.init.headers).get('authorization')).toMatch(/^Bearer /);
	});

	it('returns failures as a result with .safe()', async () => {
		const { fetch } = mockFetch(
			[400, { message: 'Invalid record', issues: { title: 'Required' } }],
			[200, { id: 'p1', title: 'Hello' }]
		);
		const pouch = createClient<Schema>('https://pouch.example.com', { fetch });

		const failed = await pouch.db.posts.insert({ title: '' }).safe();

		expect(failed.ok).toBe(false);
		expect(failed.error).toBeInstanceOf(PouchbaseError);
		expect(failed.error?.kind).toBe('invalid');
		expect(failed.error?.issues.title).toBe('Required');

		const done = await pouch.db.posts.insert({ title: 'Hello' }).safe();

		expect(done).toEqual({ ok: true, data: { id: 'p1', title: 'Hello' }, error: null });
	});

	it('tells error kinds apart', async () => {
		const { fetch } = mockFetch([403, { message: 'Only admins can do this' }]);
		const pouch = createClient<Schema>('https://pouch.example.com', { fetch });
		const error = await pouch.db.posts.findMany().catch((caught: unknown) => caught);

		expect(isPouchbaseError(error, 'forbidden')).toBe(true);
		expect(isPouchbaseError(error, 'not_found')).toBe(false);
	});

	it('is not mistaken for a promise', async () => {
		const pouch = createClient<Schema>('https://pouch.example.com');

		await expect(Promise.resolve(pouch.db)).resolves.toBe(pouch.db);
	});

	it('types records, selections, conditions and inputs from the schema', () => {
		const pouch = createClient<Schema>('https://pouch.example.com');

		expectTypeOf(() =>
			pouch.db.posts.find('p1')
		).returns.resolves.toEqualTypeOf<PostsRecord | null>();
		expectTypeOf(() =>
			pouch.db.posts.find('p1', { select: ['id', 'title'] })
		).returns.resolves.toEqualTypeOf<{ id: string; title: string } | null>();
		expectTypeOf(() =>
			pouch.db.posts.findMany({ select: ['views'] })
		).returns.resolves.toEqualTypeOf<Page<{ views: number | null }>>();
		expectTypeOf(() => pouch.auth.me()).returns.resolves.toEqualTypeOf<
			(User & { name: string | null }) | null
		>();
		expectTypeOf(() =>
			pouch.db.$collection('other').find('x')
		).returns.resolves.toEqualTypeOf<Record<string, unknown> | null>();

		// Only type-checked, never run.
		expectTypeOf(() => {
			// @ts-expect-error: `titel` is not a field of posts.
			void pouch.db.posts.findMany({ where: { titel: 'x' } });
			// @ts-expect-error: numbers have no `contains`.
			void pouch.db.posts.findMany({ where: { views: { contains: '1' } } });
			// @ts-expect-error: `status` only takes its items.
			void pouch.db.posts.findMany({ where: { status: 'archived' } });
			// @ts-expect-error: arrays are matched with `has`.
			void pouch.db.posts.findMany({ where: { tags: 'news' } });
			// @ts-expect-error: `title` is required to create a post.
			void pouch.db.posts.insert({ views: 1 });
			// @ts-expect-error: `id` is filled in by Pouchbase.
			void pouch.db.posts.insert({ title: 'x', id: 'mine' });
			// @ts-expect-error: only fields can be selected.
			void pouch.db.posts.find('p1', { select: ['nope'] });
			// @ts-expect-error: `pages` is not a collection of the schema.
			void pouch.db.pages;
		}).toBeFunction();
	});

	it('types included relations from the schema', () => {
		const pouch = createClient<Schema>('https://pouch.example.com');

		expectTypeOf(() =>
			pouch.db.posts.find('p1', {
				select: ['id'],
				include: { author: true, comments: { include: { author: true } } }
			})
		).returns.resolves.toEqualTypeOf<{
			id: string;
			author: UsersRecord | null;
			comments: { id: string; body: string; author: UsersRecord | null }[];
		} | null>();
		expectTypeOf(() =>
			pouch.db.comments.findMany({ include: { author: true } })
		).returns.resolves.toEqualTypeOf<
			Page<{ id: string; body: string; author: UsersRecord | null }>
		>();

		// Only type-checked, never run.
		expectTypeOf(() => {
			pouch.db.comments.watch(
				(event) => {
					expectTypeOf(event.record.author).toEqualTypeOf<UsersRecord | null>();
				},
				{ include: { author: true } }
			);
			// @ts-expect-error: `title` is not a relation.
			void pouch.db.posts.find('p1', { include: { title: true } });
			// @ts-expect-error: comments only relate to `author`.
			void pouch.db.posts.find('p1', { include: { comments: { include: { post: true } } } });
		}).toBeFunction();
	});
});

describe('tokens', () => {
	it('checks the expiry of a token', () => {
		expect(isTokenValid(token(60))).toBe(true);
		expect(isTokenValid(token(-60))).toBe(false);
		expect(isTokenValid('not-a-token')).toBe(false);
	});
});

describe('types', () => {
	it('downloads the generated types as text', async () => {
		const calls: string[] = [];
		const fetch = vi.fn(async (input: RequestInfo | URL) => {
			calls.push(String(input));

			return new Response('export interface Collections {}\n', {
				headers: { 'Content-Type': 'text/plain; charset=utf-8' }
			});
		}) as unknown as typeof globalThis.fetch;

		await expect(
			fetchTypes('https://pouch.example.com/api/types?token=secret', { fetch })
		).resolves.toBe('export interface Collections {}\n');
		expect(calls).toEqual(['https://pouch.example.com/api/types?token=secret']);
	});

	it('throws the message of the API for a wrong token', async () => {
		const { fetch } = mockFetch([401, { message: 'Invalid token' }]);
		const error = await fetchTypes('https://pouch.example.com/api/types?token=old', {
			fetch
		}).catch((e) => e);

		expect(error).toBeInstanceOf(PouchbaseError);
		expect(error.status).toBe(401);
		expect(error.message).toBe('Invalid token');
	});

	it('types me() with the users record of the collections', () => {
		interface UsersRecord {
			id: string;
			name: string;
			email: string | null;
		}

		interface Collections {
			users: UsersRecord;
			posts: { id: string; title: string };
		}

		const typed = new Pouchbase<Collections>('https://pouch.example.com');
		const untyped = new Pouchbase('https://pouch.example.com');

		expectTypeOf(() => typed.auth.me()).returns.resolves.toEqualTypeOf<UsersRecord | null>();
		expectTypeOf(() => untyped.auth.me()).returns.resolves.toEqualTypeOf<User | null>();
	});
});
