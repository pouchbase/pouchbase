import type { RequestEvent, RequestHandler } from './$types';
import type { MailService } from '#lib/server/services/mail.service.js';
import type { ErrorOf } from '#lib/server/services/base.service.js';
import type { z } from 'zod';

import { json, preflight, requestApiKey } from '#lib/server/api.js';
import { readJsonObject } from '#lib/server/api-body.js';
import { sendCustomMailSchema, sendMailTemplateSchema } from '#lib/schemas/mail-templates.js';

type SendError = ErrorOf<ReturnType<MailService['send']>>;

/**
 * Sends an email template, or an email of your own. Needs an API key (`Authorization: Bearer
 * pbk_…`), so only server-side code (a back-end or a function, which has `env.POUCHBASE_API_KEY`)
 * can send email; app users can't. Body: `{ "template", "to": "a@b.c" | ["a@b.c", …],
 * "variables"?: { … } }` for a template, or `{ "subject", "html", "text"?, "to" }` without one.
 * Every recipient gets an email of their own; answers `{ "sent": <count> }`.
 */
export const POST: RequestHandler = async (event) => {
	const auth = await requestApiKey(event);

	if ('response' in auth) {
		return auth.response;
	}

	const body = await readJsonObject(event.request);

	if (body && 'template' in body) {
		return sendTemplate(event, body);
	}

	const parsed = sendCustomMailSchema.safeParse(body);

	if (!parsed.success) {
		return invalidBody(
			'Send a JSON body with `template`, `to` and optionally `variables`, or with `subject`, `html`, `to` and optionally `text`',
			parsed.error
		);
	}

	const { to, ...mail } = parsed.data;
	const result = await event.locals.services.mailTemplates().sendCustom(to, mail);

	if (result.isErr()) {
		return sendFailed(result.error);
	}

	return json(result.value);
};

export const OPTIONS: RequestHandler = preflight;

async function sendTemplate(event: RequestEvent, body: Record<string, unknown>) {
	const parsed = sendMailTemplateSchema.safeParse(body);

	if (!parsed.success) {
		return invalidBody(
			'Send a JSON body with `template`, `to` and optionally `variables`',
			parsed.error
		);
	}

	const { template, to, variables } = parsed.data;
	const result = await event.locals.services.mailTemplates().send(template, to, variables);

	if (result.isErr()) {
		switch (result.error.code) {
			case 24001:
				return json({ message: `There is no email template named "${template}"` }, 404);
			case 24003:
				return json(
					{ message: "Pouchbase sends this template itself; it can't be sent through the API" },
					403
				);
			case 24004:
				return json(
					{
						message: `Missing variables: ${result.error.data.missing.join(', ')}`,
						issues: Object.fromEntries(
							result.error.data.missing.map((name) => [`variables.${name}`, 'Required'])
						)
					},
					422
				);
			case 24005:
				return json({ message: 'The template has errors; fix it on the Mail page' }, 422);
			case 24000:
				return json({ message: 'Could not send the email' }, 500);
			default:
				return sendFailed(result.error);
		}
	}

	return json(result.value);
}

function invalidBody(message: string, error: z.ZodError) {
	return json(
		{
			message,
			issues: Object.fromEntries(
				error.issues.map((issue) => [issue.path.join('.') || 'body', issue.message])
			)
		},
		400
	);
}

function sendFailed(error: SendError) {
	switch (error.code) {
		case 15001:
			return json({ message: 'Sending email is not set up' }, 503);
		case 15004:
			return json({ message: `Could not send the email: ${error.data.reason}` }, 502);
		default:
			return json({ message: 'Could not send the email' }, 500);
	}
}
