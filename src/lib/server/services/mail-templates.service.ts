import type { ErrorOf, ServiceError } from './base.service';
import type { MailService } from './mail.service';
import type { ResultAsync } from 'neverthrow';

import { asc, eq } from 'drizzle-orm';
import { errAsync, fromPromise, okAsync } from 'neverthrow';

import type {
	MailEditor,
	MailTemplateContent,
	RenderedMail,
	SourceProblem
} from '#lib/mail/mail-templates.js';
import type { TemplateVariable, Variables } from '#lib/mail/template.js';

import { htmlToText, normalizeStyle } from '#lib/mail/layout.js';
import {
	compileTemplate,
	missingVariables,
	starterSampleData,
	starterTemplate,
	SYSTEM_TEMPLATES,
	systemTemplate
} from '#lib/mail/mail-templates.js';

import { mailTemplates } from '../db';
import { Service } from './base.service';

/**
 * Email templates: a subject and a body with variables (`#lib/mail/template.ts`), made in the
 * visual editor or as HTML on the Mail pages. Functions and back-ends send them with an API key
 * through `/api/mail/send`; Pouchbase sends the built-in templates (`SYSTEM_TEMPLATES`) itself,
 * which can be changed and reset but not deleted or sent through the API.
 */

/** A template as the Mail page lists it. */
export type MailTemplateInfo = {
	name: string;
	description: string;
	editor: MailEditor;
	/** One of the templates Pouchbase sends itself. */
	system: boolean;
	/** For a system template: whether it differs from the built-in one. */
	customized: boolean;
	/** `null` for a system template that was never changed. */
	updatedAt: Date | null;
};

export type MailTemplate = MailTemplateInfo & {
	content: MailTemplateContent;
	sampleData: Variables;
	/** The variables the template uses outside loops; empty when it has problems. */
	variables: TemplateVariable[];
};

export type CreateMailTemplateInput = {
	name: string;
	description: string;
	editor: MailEditor;
};

export type UpdateMailTemplateInput = MailTemplateContent & {
	description: string;
	sampleData: Variables;
};

/** A template the API can send, with its variables, for the generated types. */
export type SendableMailTemplate = {
	name: string;
	description: string;
	/** `null` when the template has problems, so its variables aren't known. */
	variables: TemplateVariable[] | null;
};

type Row = typeof mailTemplates.$inferSelect;

type QueryFailed = ServiceError<24000, 'MAIL_TEMPLATES_QUERY_FAILED'>;
type NotFound = ServiceError<24001, 'MAIL_TEMPLATE_NOT_FOUND'>;
type NameTaken = ServiceError<24002, 'MAIL_TEMPLATE_NAME_TAKEN'>;
type SystemTemplate = ServiceError<24003, 'SYSTEM_TEMPLATE'>;
type MissingVariables = ServiceError<24004, 'MISSING_VARIABLES'> & { data: { missing: string[] } };
type InvalidTemplate = ServiceError<24005, 'INVALID_TEMPLATE'> & {
	data: { problems: SourceProblem[] };
};

type SendError = ErrorOf<ReturnType<MailService['send']>>;

function contentOf(row: Row): MailTemplateContent {
	return {
		subject: row.subject,
		preheader: row.preheader,
		editor: row.editor,
		body: row.body,
		style: normalizeStyle(row.style)
	};
}

function detail(info: MailTemplateInfo, content: MailTemplateContent, sampleData: Variables) {
	const compiled = compileTemplate(content);

	return {
		...info,
		content,
		sampleData,
		variables: compiled.ok ? compiled.variables : []
	} satisfies MailTemplate;
}

export class MailTemplatesService extends Service {
	/** The system templates first, then the others by name. */
	list(): ResultAsync<MailTemplateInfo[], QueryFailed> {
		return this.rows().map((rows) => {
			const byName = new Map(rows.map((row) => [row.name, row]));

			const system = SYSTEM_TEMPLATES.map((template) => {
				const row = byName.get(template.name);

				return {
					name: template.name,
					description: template.description,
					editor: row?.editor ?? template.content.editor,
					system: true,
					customized: !!row,
					updatedAt: row?.updatedAt ?? null
				};
			});

			const own = rows
				.filter((row) => !systemTemplate(row.name))
				.map((row) => ({
					name: row.name,
					description: row.description,
					editor: row.editor,
					system: false,
					customized: false,
					updatedAt: row.updatedAt
				}));

			return [...system, ...own];
		});
	}

	/** The templates the API can send (not the system ones), by name, with their variables. */
	sendable(): ResultAsync<SendableMailTemplate[], QueryFailed> {
		return this.rows().map((rows) =>
			rows
				.filter((row) => !systemTemplate(row.name))
				.map((row) => {
					const compiled = compileTemplate(contentOf(row));

					return {
						name: row.name,
						description: row.description,
						variables: compiled.ok ? compiled.variables : null
					};
				})
		);
	}

	get(name: string): ResultAsync<MailTemplate | null, QueryFailed> {
		const builtIn = systemTemplate(name);

		return this.findRow(name).map((row) => {
			if (builtIn) {
				return detail(
					{
						name,
						description: builtIn.description,
						editor: row?.editor ?? builtIn.content.editor,
						system: true,
						customized: !!row,
						updatedAt: row?.updatedAt ?? null
					},
					row ? contentOf(row) : builtIn.content,
					builtIn.sampleData
				);
			}

			if (!row) {
				return null;
			}

			return detail(
				{
					name: row.name,
					description: row.description,
					editor: row.editor,
					system: false,
					customized: false,
					updatedAt: row.updatedAt
				},
				contentOf(row),
				row.sampleData
			);
		});
	}

	/** A new template with starter content for its editor. */
	create(input: CreateMailTemplateInput): ResultAsync<void, QueryFailed | NameTaken> {
		if (systemTemplate(input.name)) {
			return errAsync(this.error(24002, 'MAIL_TEMPLATE_NAME_TAKEN'));
		}

		return this.findRow(input.name)
			.andThen((existing) =>
				existing ? errAsync(this.error(24002, 'MAIL_TEMPLATE_NAME_TAKEN')) : okAsync(undefined)
			)
			.andThen(() =>
				fromPromise(
					this.db.insert(mailTemplates).values({
						name: input.name,
						description: input.description,
						...starterTemplate(input.editor),
						sampleData: starterSampleData(input.editor)
					}),
					(error) => this.error(24000, 'MAIL_TEMPLATES_QUERY_FAILED', error)
				)
			)
			.map(() => undefined);
	}

	/** Saves a template; a template with problems in its tags isn't saved. */
	update(
		name: string,
		input: UpdateMailTemplateInput
	): ResultAsync<void, QueryFailed | NotFound | InvalidTemplate> {
		const compiled = compileTemplate(input);

		if (!compiled.ok) {
			return errAsync({
				...this.error(24005, 'INVALID_TEMPLATE'),
				data: { problems: compiled.problems }
			});
		}

		const builtIn = systemTemplate(name);
		const values = {
			subject: input.subject,
			preheader: input.preheader,
			editor: input.editor,
			body: input.body,
			style: normalizeStyle(input.style),
			updatedAt: new Date()
		};

		return this.findRow(name).andThen((row) => {
			if (!row && !builtIn) {
				return errAsync(this.error(24001, 'MAIL_TEMPLATE_NOT_FOUND'));
			}

			// A system template's description and variables are Pouchbase's.
			const own = builtIn ? {} : { description: input.description, sampleData: input.sampleData };

			return fromPromise(
				row
					? this.db
							.update(mailTemplates)
							.set({ ...values, ...own })
							.where(eq(mailTemplates.id, row.id))
					: this.db.insert(mailTemplates).values({
							name,
							...values,
							description: '',
							sampleData: builtIn?.sampleData ?? {}
						}),
				(error) => this.error(24000, 'MAIL_TEMPLATES_QUERY_FAILED', error)
			).map(() => undefined);
		});
	}

	delete(name: string): ResultAsync<void, QueryFailed | NotFound | SystemTemplate> {
		if (systemTemplate(name)) {
			return errAsync(this.error(24003, 'SYSTEM_TEMPLATE'));
		}

		return fromPromise(
			this.db
				.delete(mailTemplates)
				.where(eq(mailTemplates.name, name))
				.returning({ id: mailTemplates.id }),
			(error) => this.error(24000, 'MAIL_TEMPLATES_QUERY_FAILED', error)
		).andThen((rows) =>
			rows.length ? okAsync(undefined) : errAsync(this.error(24001, 'MAIL_TEMPLATE_NOT_FOUND'))
		);
	}

	/** Puts a system template back to the built-in one. */
	reset(name: string): ResultAsync<void, QueryFailed | NotFound> {
		if (!systemTemplate(name)) {
			return errAsync(this.error(24001, 'MAIL_TEMPLATE_NOT_FOUND'));
		}

		return fromPromise(this.db.delete(mailTemplates).where(eq(mailTemplates.name, name)), (error) =>
			this.error(24000, 'MAIL_TEMPLATES_QUERY_FAILED', error)
		).map(() => undefined);
	}

	/**
	 * Sends a template to every recipient, each an email of their own, with the same variables.
	 * System templates are only sent with `system` (by Pouchbase itself), so the API can't send
	 * a verification email with a link of its choosing.
	 */
	send(
		name: string,
		to: string[],
		variables: Variables,
		options: { system?: boolean } = {}
	): ResultAsync<
		{ sent: number },
		QueryFailed | NotFound | SystemTemplate | MissingVariables | InvalidTemplate | SendError
	> {
		if (systemTemplate(name) && !options.system) {
			return errAsync(this.error(24003, 'SYSTEM_TEMPLATE'));
		}

		return this.get(name)
			.andThen((template) =>
				template ? okAsync(template) : errAsync(this.error(24001, 'MAIL_TEMPLATE_NOT_FOUND'))
			)
			.andThen((template) => this.render(template.content, variables))
			.andThen((mail) => this.sendAll(to, mail));
	}

	/**
	 * Sends an email of the caller's own, without a template, to every recipient. Without `text`
	 * the plain-text version is made from the HTML.
	 */
	sendCustom(
		to: string[],
		mail: { subject: string; html: string; text?: string }
	): ResultAsync<{ sent: number }, SendError> {
		return this.sendAll(to, {
			subject: mail.subject,
			html: mail.html,
			text: mail.text || htmlToText(mail.html)
		});
	}

	/** Sends the content from the editor, saved or not, with its sample data. */
	sendTest(
		content: MailTemplateContent,
		to: string,
		sampleData: Variables
	): ResultAsync<void, MissingVariables | InvalidTemplate | SendError> {
		return this.render(content, sampleData).andThen((mail) => this.services.mail().send(to, mail));
	}

	/** Sends the same email to every recipient, each an email of their own, one after another. */
	private sendAll(to: string[], mail: RenderedMail): ResultAsync<{ sent: number }, SendError> {
		return to
			.reduce<ResultAsync<number, SendError>>(
				(chain, address) =>
					chain.andThen((sent) =>
						this.services
							.mail()
							.send(address, mail)
							.map(() => sent + 1)
					),
				okAsync(0)
			)
			.map((sent) => ({ sent }));
	}

	private render(
		content: MailTemplateContent,
		variables: Variables
	): ResultAsync<RenderedMail, MissingVariables | InvalidTemplate> {
		const compiled = compileTemplate({ ...content, style: normalizeStyle(content.style) });

		if (!compiled.ok) {
			return errAsync({
				...this.error(24005, 'INVALID_TEMPLATE'),
				data: { problems: compiled.problems }
			});
		}

		const missing = missingVariables(compiled.variables, variables);

		if (missing.length) {
			return errAsync({ ...this.error(24004, 'MISSING_VARIABLES'), data: { missing } });
		}

		return okAsync(compiled.render(variables));
	}

	private rows(): ResultAsync<Row[], QueryFailed> {
		return fromPromise(
			this.db.select().from(mailTemplates).orderBy(asc(mailTemplates.name)),
			(error) => this.error(24000, 'MAIL_TEMPLATES_QUERY_FAILED', error)
		);
	}

	private findRow(name: string): ResultAsync<Row | null, QueryFailed> {
		return fromPromise(
			this.db.select().from(mailTemplates).where(eq(mailTemplates.name, name)),
			(error) => this.error(24000, 'MAIL_TEMPLATES_QUERY_FAILED', error)
		).map(([row]) => row ?? null);
	}
}
