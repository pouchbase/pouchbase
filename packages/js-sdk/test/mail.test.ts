import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { createClient, Pouchbase, PouchbaseError } from '../src/index.js';

function mockFetch(status: number, body: unknown) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
		calls.push({ url: String(input), init });

		return new Response(JSON.stringify(body), {
			status,
			headers: { 'Content-Type': 'application/json' }
		});
	});

	return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

describe('pouch.mail', () => {
	it('sends a template with the API key instead of the user token', async () => {
		const { fetch, calls } = mockFetch(200, { sent: 2 });
		const pouch = new Pouchbase('https://pouch.example.com', { fetch, apiKey: 'pbk_secret' });
		pouch.session.begin({ token: 'user-token', userId: 'u1' });

		const result = await pouch.mail.send('welcome', {
			to: ['ada@example.com', 'alan@example.com'],
			variables: { name: 'Ada' }
		});

		expect(result).toEqual({ sent: 2 });
		expect(calls).toHaveLength(1);

		const { url, init } = calls[0] ?? { url: '', init: {} };

		expect(url).toBe('https://pouch.example.com/api/mail/send');
		expect(init.method).toBe('POST');
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer pbk_secret');
		expect(JSON.parse(String(init.body))).toEqual({
			template: 'welcome',
			to: ['ada@example.com', 'alan@example.com'],
			variables: { name: 'Ada' }
		});
	});

	it('sends an email of your own without a template', async () => {
		const { fetch, calls } = mockFetch(200, { sent: 1 });
		const pouch = new Pouchbase('https://pouch.example.com', { fetch, apiKey: 'pbk_secret' });

		const result = await pouch.mail.send(
			{ subject: 'Hi Ada', html: '<p>Welcome!</p>' },
			{ to: 'ada@example.com' }
		);

		expect(result).toEqual({ sent: 1 });
		expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
			subject: 'Hi Ada',
			html: '<p>Welcome!</p>',
			to: 'ada@example.com'
		});
	});

	it('needs an API key', async () => {
		const { fetch, calls } = mockFetch(200, { sent: 1 });
		const pouch = new Pouchbase('https://pouch.example.com', { fetch });
		const error = await pouch.mail.send('welcome', { to: 'ada@example.com' }).catch((e) => e);

		expect(error).toBeInstanceOf(PouchbaseError);
		expect(error.kind).toBe('unauthorized');
		expect(calls).toHaveLength(0);
	});

	it('passes on missing variables as issues', async () => {
		const { fetch } = mockFetch(422, {
			message: 'Missing variables: name',
			issues: { 'variables.name': 'Required' }
		});
		const pouch = new Pouchbase('https://pouch.example.com', { fetch, apiKey: 'pbk_secret' });
		const error = await pouch.mail.send('welcome', { to: 'ada@example.com' }).catch((e) => e);

		expect(error.status).toBe(422);
		expect(error.issues).toEqual({ 'variables.name': 'Required' });
	});

	it('types the names and variables of the generated MailTemplates', async () => {
		interface MailTemplates {
			welcome: { name: unknown; items?: unknown };
			'order-shipped': { order?: unknown };
			ping: Record<string, never>;
		}

		const { fetch, calls } = mockFetch(200, { sent: 1 });
		const pouch = createClient<object, MailTemplates>('https://pouch.example.com', {
			fetch,
			apiKey: 'pbk_secret'
		});

		await pouch.mail.send('welcome', { to: 'ada@example.com', variables: { name: 'Ada' } });
		await pouch.mail.send('order-shipped', { to: 'ada@example.com' });
		await pouch.mail.send('ping', { to: 'ada@example.com' });
		await pouch.mail.send({ subject: 'Hi', html: '<p>Hi</p>' }, { to: 'ada@example.com' });

		expect(calls).toHaveLength(4);

		// Only type-checked, never run.
		expectTypeOf(() => {
			// @ts-expect-error: there is no template named `welkom`.
			void pouch.mail.send('welkom', { to: 'ada@example.com' });
			// @ts-expect-error: `welcome` has a required variable.
			void pouch.mail.send('welcome', { to: 'ada@example.com' });
			// @ts-expect-error: `name` is required.
			void pouch.mail.send('welcome', { to: 'ada@example.com', variables: { items: [] } });
			// @ts-expect-error: `nam` is not a variable of `welcome`.
			void pouch.mail.send('welcome', { to: 'a@b.c', variables: { name: 'Ada', nam: 'x' } });
			// @ts-expect-error: `ping` has no variables.
			void pouch.mail.send('ping', { to: 'ada@example.com', variables: { name: 'Ada' } });
			// @ts-expect-error: an email of your own has no variables.
			void pouch.mail.send({ subject: 'Hi', html: '<p>Hi</p>' }, { to: 'a@b.c', variables: {} });
		}).toBeFunction();
	});

	it('allows any template without MailTemplates', () => {
		const pouch = new Pouchbase('https://pouch.example.com', { apiKey: 'pbk_secret' });

		// Only type-checked, never run: any name, with or without variables.
		expectTypeOf(() => {
			void pouch.mail.send('anything', { to: 'ada@example.com' });
			void pouch.mail.send('anything', { to: 'ada@example.com', variables: { x: 1 } });
		}).toBeFunction();
	});
});
