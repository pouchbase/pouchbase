import type { Pouchbase } from '../client.js';
import { PouchbaseError } from '../error.js';

/** Options for `pouch.mail.send()`. */
export type SendMailOptions<V extends Record<string, unknown> = Record<string, unknown>> = {
	/** Name of the email template, as on the Mail page. */
	template: string;
	/** One address or up to 50; each recipient gets an email of their own. */
	to: string | string[];
	/** Values for the template's variables, such as `{ name: 'Ada' }`. */
	variables?: V;
	signal?: AbortSignal;
};

/**
 * Email templates (`POST /api/mail/send`). Sending needs an API key (`new Pouchbase(url,
 * { apiKey })`), so only server-side code can send email: a function has its key in
 * `env.POUCHBASE_API_KEY`; for other back-ends, create one on the API keys page.
 */
export class MailService {
	readonly #pouch: Pouchbase<object>;
	readonly #apiKey: string | undefined;

	constructor(pouch: Pouchbase<object>, apiKey: string | undefined) {
		this.#pouch = pouch;
		this.#apiKey = apiKey;
	}

	/**
	 * Sends an email template and returns how many emails were sent.
	 *
	 * ```ts
	 * const pouch = new Pouchbase(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_API_KEY });
	 * await pouch.mail.send({ template: 'welcome', to: 'ada@example.com', variables: { name: 'Ada' } });
	 * ```
	 *
	 * @throws {PouchbaseError} Without an `apiKey`, and for a non-2xx response: `404` for an unknown
	 *   template, `422` for missing variables (in `issues`), `503` when sending email isn't set up.
	 */
	async send<V extends Record<string, unknown>>(
		options: SendMailOptions<V>
	): Promise<{ sent: number }> {
		if (!this.#apiKey) {
			throw new PouchbaseError(
				'Sending email needs an API key: new Pouchbase(url, { apiKey: env.POUCHBASE_API_KEY })',
				{ status: 401 }
			);
		}

		return this.#pouch.request<{ sent: number }>('/api/mail/send', {
			method: 'POST',
			body: { template: options.template, to: options.to, variables: options.variables ?? {} },
			headers: { Authorization: `Bearer ${this.#apiKey}` },
			auth: false,
			signal: options.signal
		});
	}
}
