import type { ContextError, ServiceError } from './base.service';
import type { MailContent } from '../mail/templates';
import type { MailProvider } from '#lib/schemas/mail.js';
import type { ResultAsync } from 'neverthrow';

import { MAIL_PROVIDERS, SMTP_SECURITY } from '#lib/schemas/mail.js';

import {
	cloudflareMailAvailable,
	sendCloudflare,
	sendSmtp,
	type MailMessage,
	type SmtpSecurity
} from '../mail';
import { reasonOf } from '../errors';
import { testEmail } from '../mail/templates';
import { Service } from './base.service';

/** The mail settings as shown on the settings page; the SMTP password never leaves the server. */
export type MailSettings = {
	provider: MailProvider;
	senderName: string;
	senderAddress: string;
	smtpHost: string;
	smtpPort: number;
	smtpSecurity: SmtpSecurity;
	smtpUsername: string;
	hasSmtpPassword: boolean;
	/** Whether Cloudflare Email Service can be used (the app has Cloudflare credentials). */
	cloudflareAvailable: boolean;
};

export type UpdateMailSettingsInput = Omit<
	MailSettings,
	'hasSmtpPassword' | 'cloudflareAvailable'
> & {
	/** Empty keeps the stored password. */
	smtpPassword?: string;
};

const KEYS = [
	'mail_provider',
	'mail_sender_name',
	'mail_sender_address',
	'smtp_host',
	'smtp_port',
	'smtp_security',
	'smtp_username',
	'smtp_password'
] as const;

export type MailError =
	| ContextError
	| ServiceError<5001, 'SET_SETTING_FAILED'>
	| ServiceError<15000, 'CLOUDFLARE_UNAVAILABLE'>
	| ServiceError<15001, 'MAIL_NOT_CONFIGURED'>
	| (ServiceError<15004, 'SEND_FAILED'> & { data: { reason: string } })
	| ServiceError<15005, 'MAIL_FAILED'>;

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
	return values.includes(value as T) ? (value as T) : fallback;
}

export class MailService extends Service {
	settings(): ResultAsync<MailSettings, MailError> {
		return this.run(async () => {
			const { smtpPassword, ...settings } = await this.stored();

			return { ...settings, hasSmtpPassword: !!smtpPassword };
		}, this.failed);
	}

	update(input: UpdateMailSettingsInput): ResultAsync<void, MailError> {
		return this.run(async () => {
			if (input.provider === 'cloudflare' && !cloudflareMailAvailable()) {
				this.fail(15000, 'CLOUDFLARE_UNAVAILABLE');
			}

			const current = await this.stored();

			await this.must(
				this.services.settings().setMany({
					mail_provider: input.provider,
					mail_sender_name: input.senderName,
					mail_sender_address: input.senderAddress,
					smtp_host: input.smtpHost,
					smtp_port: String(input.smtpPort),
					smtp_security: input.smtpSecurity,
					smtp_username: input.smtpUsername,
					smtp_password: input.smtpPassword || current.smtpPassword
				})
			);
		}, this.failed);
	}

	/** Whether mail can be sent; flows that send mail are only offered when it can. */
	enabled(): ResultAsync<boolean, MailError> {
		return this.run(async () => {
			const settings = await this.stored();

			return settings.provider !== 'none' && !!settings.senderAddress;
		}, this.failed);
	}

	/** Sends an email from the configured sender. */
	send(to: string, content: MailContent): ResultAsync<void, MailError> {
		return this.run(async () => {
			const settings = await this.stored();

			if (settings.provider === 'none' || !settings.senderAddress) {
				this.fail(15001, 'MAIL_NOT_CONFIGURED');
			}

			const message: MailMessage = {
				from: { address: settings.senderAddress, name: settings.senderName },
				to: { address: to },
				...content
			};

			try {
				await (settings.provider === 'cloudflare'
					? sendCloudflare(message)
					: sendSmtp(
							{
								host: settings.smtpHost,
								port: settings.smtpPort,
								security: settings.smtpSecurity,
								username: settings.smtpUsername,
								password: settings.smtpPassword
							},
							message
						));
			} catch (error) {
				console.error('[pouchbase] Could not send mail', error);
				this.fail(15004, 'SEND_FAILED', {
					cause: error,
					data: { reason: reasonOf(error) ?? String(error) }
				});
			}
		}, this.failed);
	}

	/** Sends a test email, to check the settings. */
	sendTest(to: string): ResultAsync<void, MailError> {
		return this.send(to, testEmail());
	}

	private failed = (error: unknown) => this.error(15005, 'MAIL_FAILED', error);

	private async stored(): Promise<
		Omit<MailSettings, 'hasSmtpPassword'> & { smtpPassword: string }
	> {
		const values = await this.must(this.services.settings().getMany(KEYS));
		const cloudflareAvailable = cloudflareMailAvailable();
		let provider = oneOf(MAIL_PROVIDERS, values.mail_provider, 'none');

		// The credentials were removed after Cloudflare was chosen.
		if (provider === 'cloudflare' && !cloudflareAvailable) {
			provider = 'none';
		}

		return {
			provider,
			senderName: values.mail_sender_name ?? '',
			senderAddress: values.mail_sender_address ?? '',
			smtpHost: values.smtp_host ?? '',
			smtpPort: Number(values.smtp_port) || 465,
			smtpSecurity: oneOf(SMTP_SECURITY, values.smtp_security, 'tls'),
			smtpUsername: values.smtp_username ?? '',
			smtpPassword: values.smtp_password ?? '',
			cloudflareAvailable
		};
	}
}
