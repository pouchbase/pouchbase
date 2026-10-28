import type { PouchbaseClient } from '../client.js';
import { PouchbaseError } from '../error.js';
import type { DefaultMailTemplates } from '../types.js';

/**
 * `variables`, optional when `{}` fits `V`: when the template has no required variables.
 */
type VariablesOption<V extends object> =
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	{} extends V
		? {
				/** Values for the template's variables, such as `{ name: 'Ada' }`. */
				variables?: V;
			}
		: {
				/** Values for the template's variables, such as `{ name: 'Ada' }`. */
				variables: V;
			};

/**
 * Options for sending a template with `pouch.mail.send()`. `variables` is required when the
 * template (`V`, from the generated `MailTemplates`) has required variables.
 */
export type SendMailOptions<V extends object = Record<string, unknown>> = {
	/** One address or up to 50; each recipient gets an email of their own. */
	to: string | string[];
	signal?: AbortSignal;
} & VariablesOption<V>;

/** Options for sending an email of your own with `pouch.mail.send()`. */
export type SendCustomMailOptions = {
	/** One address or up to 50; each recipient gets an email of their own. */
	to: string | string[];
	signal?: AbortSignal;
};

/** An email of your own for `pouch.mail.send()`, sent without a template. */
export type CustomMail = {
	subject: string;
	/** The full HTML of the email. */
	html: string;
	/** The plain-text version; made from the HTML when left out. */
	text?: string;
};

/**
 * Email templates and emails of your own (`POST /api/mail/send`). Sending needs an API key
 * (`new Pouchbase(url, { apiKey })`), so only server-side code can send email: a function has its
 * key in `env.POUCHBASE_API_KEY`; for other back-ends, create one on the API keys page.
 *
 * Pass the `MailTemplates` from `pouchbase types` to type the templates' names and variables:
 * `createClient<Schema, MailTemplates>(url, { apiKey })`.
 */
export class MailService<M extends object = DefaultMailTemplates> {
	readonly #pouch: PouchbaseClient;
	readonly #apiKey: string | undefined;

	constructor(pouch: PouchbaseClient, apiKey: string | undefined) {
		this.#pouch = pouch;
		this.#apiKey = apiKey;
	}

	/**
	 * Sends an email template (by name) or an email of your own (`{ subject, html, text? }`) and
	 * returns how many emails were sent.
	 *
	 * ```ts
	 * const pouch = new Pouchbase(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_API_KEY });
	 * await pouch.mail.send('welcome', { to: 'ada@example.com', variables: { name: 'Ada' } });
	 * await pouch.mail.send({ subject: 'Hi Ada', html: '<p>Welcome!</p>' }, { to: 'ada@example.com' });
	 * ```
	 *
	 * @throws {PouchbaseError} Without an `apiKey`, and for a non-2xx response: `404` for an unknown
	 *   template, `422` for missing variables (in `issues`), `503` when sending email isn't set up.
	 */
	send<T extends keyof M & string>(
		template: T,
		options: SendMailOptions<M[T] & object>
	): Promise<{ sent: number }>;
	send(mail: CustomMail, options: SendCustomMailOptions): Promise<{ sent: number }>;
	async send(
		mail: string | CustomMail,
		options: SendCustomMailOptions & { variables?: object }
	): Promise<{ sent: number }> {
		if (!this.#apiKey) {
			throw new PouchbaseError(
				'Sending email needs an API key: new Pouchbase(url, { apiKey: env.POUCHBASE_API_KEY })',
				{ status: 401 }
			);
		}

		const body =
			typeof mail === 'string'
				? { template: mail, to: options.to, variables: options.variables ?? {} }
				: { subject: mail.subject, html: mail.html, text: mail.text, to: options.to };

		return this.#pouch.request<{ sent: number }>('/api/mail/send', {
			method: 'POST',
			body,
			signal: options.signal
		});
	}
}
