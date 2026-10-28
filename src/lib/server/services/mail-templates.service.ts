import type { ServiceError } from './base.service';
import type { MailError } from './mail.service';
import type { ResultAsync } from 'neverthrow';

import { asc, eq } from 'drizzle-orm';

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

export type MailTemplatesError =
	| MailError
	| ServiceError<24000, 'MAIL_TEMPLATES_FAILED'>
	| ServiceError<24001, 'MAIL_TEMPLATE_NOT_FOUND'>
	| ServiceError<24002, 'MAIL_TEMPLATE_NAME_TAKEN'>
	| ServiceError<24003, 'SYSTEM_TEMPLATE'>
	| (ServiceError<24004, 'MISSING_VARIABLES'> & { data: { missing: string[] } })
	| (ServiceError<24005, 'INVALID_TEMPLATE'> & { data: { problems: SourceProblem[] } });

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
	list(): ResultAsync<MailTemplateInfo[], MailTemplatesError> {
		return this.run(async () => {
			const rows = await this.rows();
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
		}, this.failed);
	}

	/** The templates the API can send (not the system ones), by name, with their variables. */
	sendable(): ResultAsync<SendableMailTemplate[], MailTemplatesError> {
		return this.run(async () => {
			const rows = await this.rows();

			return rows
				.filter((row) => !systemTemplate(row.name))
				.map((row) => {
					const compiled = compileTemplate(contentOf(row));

					return {
						name: row.name,
						description: row.description,
						variables: compiled.ok ? compiled.variables : null
					};
				});
		}, this.failed);
	}

	get(name: string): ResultAsync<MailTemplate | null, MailTemplatesError> {
		return this.run(() => this.find(name), this.failed);
	}

	/** A new template with starter content for its editor. */
	create(input: CreateMailTemplateInput): ResultAsync<void, MailTemplatesError> {
		return this.run(async () => {
			if (systemTemplate(input.name) || (await this.findRow(input.name))) {
				this.fail(24002, 'MAIL_TEMPLATE_NAME_TAKEN');
			}

			await this.db.insert(mailTemplates).values({
				name: input.name,
				description: input.description,
				...starterTemplate(input.editor),
				sampleData: starterSampleData(input.editor)
			});
		}, this.failed);
	}

	/** Saves a template; a template with problems in its tags isn't saved. */
	update(name: string, input: UpdateMailTemplateInput): ResultAsync<void, MailTemplatesError> {
		return this.run(async () => {
			const compiled = compileTemplate(input);

			if (!compiled.ok) {
				this.fail(24005, 'INVALID_TEMPLATE', { data: { problems: compiled.problems } });
			}

			const builtIn = systemTemplate(name);
			const row = await this.findRow(name);

			if (!row && !builtIn) {
				this.fail(24001, 'MAIL_TEMPLATE_NOT_FOUND');
			}

			const values = {
				subject: input.subject,
				preheader: input.preheader,
				editor: input.editor,
				body: input.body,
				style: normalizeStyle(input.style),
				updatedAt: new Date()
			};

			if (!row) {
				await this.db.insert(mailTemplates).values({
					name,
					...values,
					description: '',
					sampleData: builtIn?.sampleData ?? {}
				});

				return;
			}

			// A system template's description and variables are Pouchbase's.
			const own = builtIn ? {} : { description: input.description, sampleData: input.sampleData };

			await this.db
				.update(mailTemplates)
				.set({ ...values, ...own })
				.where(eq(mailTemplates.id, row.id));
		}, this.failed);
	}

	delete(name: string): ResultAsync<void, MailTemplatesError> {
		return this.run(async () => {
			if (systemTemplate(name)) {
				this.fail(24003, 'SYSTEM_TEMPLATE');
			}

			const rows = await this.db
				.delete(mailTemplates)
				.where(eq(mailTemplates.name, name))
				.returning({ id: mailTemplates.id });

			if (!rows.length) {
				this.fail(24001, 'MAIL_TEMPLATE_NOT_FOUND');
			}
		}, this.failed);
	}

	/** Puts a system template back to the built-in one. */
	reset(name: string): ResultAsync<void, MailTemplatesError> {
		return this.run(async () => {
			if (!systemTemplate(name)) {
				this.fail(24001, 'MAIL_TEMPLATE_NOT_FOUND');
			}

			await this.db.delete(mailTemplates).where(eq(mailTemplates.name, name));
		}, this.failed);
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
	): ResultAsync<{ sent: number }, MailTemplatesError> {
		return this.run(async () => {
			if (systemTemplate(name) && !options.system) {
				this.fail(24003, 'SYSTEM_TEMPLATE');
			}

			const template = await this.find(name);

			if (!template) {
				this.fail(24001, 'MAIL_TEMPLATE_NOT_FOUND');
			}

			return this.sendAll(to, this.render(template.content, variables));
		}, this.failed);
	}

	/**
	 * Sends an email of the caller's own, without a template, to every recipient. Without `text`
	 * the plain-text version is made from the HTML.
	 */
	sendCustom(
		to: string[],
		mail: { subject: string; html: string; text?: string }
	): ResultAsync<{ sent: number }, MailTemplatesError> {
		return this.run(
			() =>
				this.sendAll(to, {
					subject: mail.subject,
					html: mail.html,
					text: mail.text || htmlToText(mail.html)
				}),
			this.failed
		);
	}

	/** Sends the content from the editor, saved or not, with its sample data. */
	sendTest(
		content: MailTemplateContent,
		to: string,
		sampleData: Variables
	): ResultAsync<void, MailTemplatesError> {
		return this.run(async () => {
			await this.must(this.services.mail().send(to, this.render(content, sampleData)));
		}, this.failed);
	}

	private failed = (error: unknown) => this.error(24000, 'MAIL_TEMPLATES_FAILED', error);

	private async find(name: string): Promise<MailTemplate | null> {
		const builtIn = systemTemplate(name);
		const row = await this.findRow(name);

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
	}

	/** Sends the same email to every recipient, each an email of their own, one after another. */
	private async sendAll(to: string[], mail: RenderedMail) {
		const mailer = this.services.mail();

		for (const address of to) {
			await this.must(mailer.send(address, mail));
		}

		return { sent: to.length };
	}

	private render(content: MailTemplateContent, variables: Variables): RenderedMail {
		const compiled = compileTemplate({ ...content, style: normalizeStyle(content.style) });

		if (!compiled.ok) {
			this.fail(24005, 'INVALID_TEMPLATE', { data: { problems: compiled.problems } });
		}

		const missing = missingVariables(compiled.variables, variables);

		if (missing.length) {
			this.fail(24004, 'MISSING_VARIABLES', { data: { missing } });
		}

		return compiled.render(variables);
	}

	private rows(): Promise<Row[]> {
		return this.db.select().from(mailTemplates).orderBy(asc(mailTemplates.name));
	}

	private async findRow(name: string): Promise<Row | null> {
		const [row] = await this.db.select().from(mailTemplates).where(eq(mailTemplates.name, name));

		return row ?? null;
	}
}
