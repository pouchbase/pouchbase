import type { ContextError, ErrorOf, ServiceError } from './base.service';
import type { CollectionsService } from './collections.service';
import type { FilesService } from './files.service';
import type { MailTemplatesService } from './mail-templates.service';
import type { TokenKey, TokenPurpose, PurposeClaims } from '../auth/tokens';
import type { Result } from 'neverthrow';

import { okAsync, ResultAsync } from 'neverthrow';

import { USERS_COLLECTION } from '#lib/auth/users.js';
import { appPassword } from '#lib/schemas/password-auth.js';

import { batchDatabase, queryDatabase, queryObjects } from '../db/query';
import { generateToken, hashPassword } from '../crypto';
import { inBackground } from '../platform/runtime';
import { Service } from './base.service';
import { AUTH_TABLE_STATEMENTS, authFields, issuesByField } from '../auth/users-table';
import {
	signPurposeToken,
	signUserToken,
	tokenKey,
	verifyPurposeToken,
	verifyUserToken
} from '../auth/tokens';

/** The built-in collection app users are stored in. */
export { USERS_COLLECTION } from '#lib/auth/users.js';

export type AppUser = Record<string, unknown> & { id: string };

/** Validation messages keyed by input field. */
export type AuthIssues = Record<string, string>;

export type InvalidInputError = ServiceError<11025, 'INVALID_INPUT'> & {
	data: { issues: AuthIssues };
};

/**
 * Everything the auth services can return. The codes callers branch on keep their meaning; what
 * went wrong underneath an `AUTH_FAILED` is in its `reason`.
 */
export type AuthError =
	| ContextError
	| ServiceError<5001, 'SET_SETTING_FAILED'>
	| ServiceError<10000, 'OAUTH_PROVIDERS_FAILED'>
	| ServiceError<19001, 'PLUGINS_FAILED'>
	| ErrorOf<ReturnType<FilesService['ensureFilesCollection']>>
	| ErrorOf<ReturnType<CollectionsService['ensureSystem']>>
	| ErrorOf<ReturnType<MailTemplatesService['send']>>
	| ServiceError<11000, 'AUTH_FAILED'>
	| ServiceError<11001, 'PROVIDER_NOT_ENABLED'>
	| ServiceError<11005, 'EMAIL_IN_USE'>
	| ServiceError<11006, 'INVALID_TOKEN'>
	| ServiceError<11007, 'USER_NOT_FOUND'>
	| ServiceError<11010, 'INVALID_OAUTH_REQUEST'>
	| ServiceError<11011, 'OAUTH_REQUEST_NOT_FOUND'>
	| ServiceError<11012, 'INVALID_VERIFIER'>
	| ServiceError<11014, 'PROVIDER_NOT_FOUND'>
	| ServiceError<11020, 'PASSWORD_AUTH_DISABLED'>
	| ServiceError<11021, 'SIGN_UP_DISABLED'>
	| ServiceError<11022, 'INVALID_CREDENTIALS'>
	| ServiceError<11024, 'EMAIL_TAKEN'>
	| InvalidInputError
	| ServiceError<11027, 'MAIL_DISABLED'>
	| ServiceError<11028, 'INVALID_RESET_TOKEN'>
	| ServiceError<11029, 'INVALID_VERIFICATION_TOKEN'>
	| ServiceError<11032, 'EMAIL_NOT_VERIFIED'>;

// Once ensured, the users collection stays; cache it per isolate.
let usersReady = false;

/** The setup that is running, so concurrent first requests share it instead of racing. */
let usersSetup: Promise<Result<void, AuthError>> | null = null;

/**
 * App users: the built-in `users` collection, their tokens and the email links (password reset,
 * verification). Signing in is in `PasswordAuthService` and `OAuthService`.
 */
export class AuthService extends Service {
	/**
	 * Creates the built-in `users` collection with its auth fields, and the internal tables that
	 * hold passwords and the links to provider accounts. Adopts an existing `users` collection.
	 */
	ensureUsersCollection(): ResultAsync<void, AuthError> {
		if (usersReady) {
			return okAsync(undefined);
		}

		const setup = (usersSetup ??= Promise.resolve(
			this.run(
				async () => {
					await this.must(this.services.files().ensureFilesCollection());
					await this.must(this.services.collections().ensureSystem(USERS_COLLECTION, authFields()));
					await batchDatabase(await this.appDatabaseId(), AUTH_TABLE_STATEMENTS);
					usersReady = true;
				},
				(error) => this.error(11000, 'AUTH_FAILED', error)
			)
		).then((result) => {
			usersSetup = null;

			return result;
		}));

		return new ResultAsync(setup);
	}

	/** A sign-in token for the user. */
	signToken(userId: string): ResultAsync<string, AuthError> {
		return this.run(
			async () => signUserToken(await this.key(), userId),
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/** The user a sign-in token belongs to. */
	verifyToken(token: string): ResultAsync<AppUser, AuthError> {
		return this.run(
			async () => {
				const userId = await this.userIdOf(token);
				const [user] = await queryObjects(
					await this.appDatabaseId(),
					`SELECT * FROM "users" WHERE "id" = ?`,
					[userId]
				);

				return (user as AppUser | undefined) ?? this.fail(11007, 'USER_NOT_FOUND');
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/**
	 * Emails a link to choose a new password to the user with this email address. Nothing happens
	 * when there is no such user, so the API doesn't reveal which addresses have an account.
	 */
	requestPasswordReset(email: string): ResultAsync<void, AuthError> {
		return this.run(
			async () => {
				const { enabled } = await this.must(this.services.passwordAuth().settings());

				if (!enabled) {
					this.fail(11020, 'PASSWORD_AUTH_DISABLED');
				}

				await this.requireMail();

				const [row] = await queryDatabase(
					await this.appDatabaseId(),
					`SELECT "users"."id", "users"."email", "_passwords"."updated_at" FROM "users" LEFT JOIN "_passwords" ON "_passwords"."user_id" = "users"."id" WHERE "users"."email" = ?`,
					[email.trim().toLowerCase()]
				);

				if (!row) {
					return;
				}

				// The token carries the moment the password last changed, so it works once.
				const address = String(row[1]);
				const token = await this.signLink(String(row[0]), 'password_reset', {
					email: address,
					pwd: Number(row[2] ?? 0)
				});

				await this.sendLink('password-reset', address, '/account/reset-password', token);
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/** Sets a new password with the token from the reset email. */
	confirmPasswordReset(token: string, password: string): ResultAsync<void, AuthError> {
		return this.run(
			async () => {
				const parsed = appPassword.safeParse(password);

				if (!parsed.success) {
					this.fail(11025, 'INVALID_INPUT', {
						data: {
							issues: issuesByField(
								parsed.error.issues.map((issue) => ({ ...issue, path: ['password'] }))
							)
						}
					});
				}

				const claims = await this.claimsOf(token, 'password_reset', 11028, 'INVALID_RESET_TOKEN');
				const databaseId = await this.appDatabaseId();
				const [row] = await queryDatabase(
					databaseId,
					`SELECT "users"."email", "_passwords"."updated_at" FROM "users" LEFT JOIN "_passwords" ON "_passwords"."user_id" = "users"."id" WHERE "users"."id" = ?`,
					[claims.sub]
				);

				if (!row || String(row[0]) !== claims.email || Number(row[1] ?? 0) !== claims.pwd) {
					this.fail(11028, 'INVALID_RESET_TOKEN');
				}

				const now = Date.now();

				// Following the link proves the address, so the user is verified too.
				const [, verified] = await batchDatabase(databaseId, [
					{
						sql: `INSERT INTO "_passwords" ("user_id", "hash", "updated_at") VALUES (?, ?, ?) ON CONFLICT ("user_id") DO UPDATE SET "hash" = excluded."hash", "updated_at" = excluded."updated_at"`,
						params: [claims.sub, await hashPassword(parsed.data), now]
					},
					{
						sql: `UPDATE "users" SET "verified" = 1, "updated_at" = ? WHERE "id" = ? AND "verified" = 0 RETURNING "id"`,
						params: [now, claims.sub]
					}
				]);

				if (verified?.length) {
					this.announce('update', claims.sub);
				}
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/**
	 * Emails a link to verify the address to the user with this email address. Nothing happens when
	 * there is no such user or the user is verified already.
	 */
	requestVerification(email: string): ResultAsync<void, AuthError> {
		return this.run(
			async () => {
				await this.requireMail();

				const [row] = await queryDatabase(
					await this.appDatabaseId(),
					`SELECT "id", "email" FROM "users" WHERE "email" = ? AND "verified" = 0`,
					[email.trim().toLowerCase()]
				);

				if (!row) {
					return;
				}

				const address = String(row[1]);
				const token = await this.signLink(String(row[0]), 'verification', { email: address });

				await this.sendLink('verification', address, '/account/verify-email', token);
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/** Marks the user as verified with the token from the verification email. */
	confirmVerification(token: string): ResultAsync<void, AuthError> {
		return this.run(
			async () => {
				const claims = await this.claimsOf(
					token,
					'verification',
					11029,
					'INVALID_VERIFICATION_TOKEN'
				);
				const databaseId = await this.appDatabaseId();

				// Only while the user still has the address the link was sent to.
				const [row] = await queryDatabase(
					databaseId,
					`SELECT "verified" FROM "users" WHERE "id" = ? AND "email" = ?`,
					[claims.sub, claims.email]
				);

				if (!row) {
					this.fail(11029, 'INVALID_VERIFICATION_TOKEN');
				}

				if (!Number(row[0])) {
					await queryDatabase(
						databaseId,
						`UPDATE "users" SET "verified" = 1, "updated_at" = ? WHERE "id" = ?`,
						[Date.now(), claims.sub]
					);
					this.announce('update', claims.sub);
				}
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/**
	 * Finishes a user created by a sign-up, which inserts the row directly: fills the computed
	 * fields and sends the realtime event. Best effort: a sign-up never fails because of them.
	 */
	async signedUp(userId: string): Promise<void> {
		await this.services.records().refreshComputed(USERS_COLLECTION, [userId]);
		this.announce('create', userId);
	}

	/** Sends the realtime event of a user an auth service wrote directly. */
	announce(action: 'create' | 'update', userId: string): void {
		inBackground(this.services.records().announceStored(USERS_COLLECTION, action, [userId]));
	}

	/** The id of the app database; the users live there. */
	async appDatabaseId(): Promise<string> {
		return (await this.must(this.services.database().requireApp())).id;
	}

	/** Flows that send mail need mail settings. Throws `MAIL_DISABLED` otherwise. */
	async requireMail(): Promise<void> {
		if (!(await this.must(this.services.mail().enabled()))) {
			this.fail(11027, 'MAIL_DISABLED');
		}
	}

	/** The user id of a sign-in token; throws `INVALID_TOKEN`. */
	private async userIdOf(token: string): Promise<string> {
		try {
			return await verifyUserToken(await this.key(), token);
		} catch (error) {
			return this.fail(11006, 'INVALID_TOKEN', { cause: error });
		}
	}

	/** The claims of an email link; throws the link's own code when the token is bad. */
	private async claimsOf<Code extends 11028 | 11029, Message extends string>(
		token: string,
		purpose: TokenPurpose,
		code: Code,
		message: Message
	) {
		try {
			return await verifyPurposeToken(await this.key(), token, purpose);
		} catch (error) {
			return this.fail(code, message, { cause: error });
		}
	}

	private async signLink(userId: string, purpose: TokenPurpose, claims: PurposeClaims) {
		return signPurposeToken(await this.key(), userId, purpose, claims);
	}

	/** Sends the built-in email with a link to a page of this deployment that handles it. */
	private async sendLink(template: string, email: string, path: string, token: string) {
		const url = new URL(path, this.origin);
		url.searchParams.set('token', token);

		await this.must(
			this.services
				.mailTemplates()
				.send(template, [email], { url: url.toString(), email }, { system: true })
		);
	}

	/** Signing key for user tokens; generated on first use and stored in the settings. */
	private async key(): Promise<TokenKey> {
		const settings = this.services.settings();
		let secret = await this.must(settings.get('auth_token_secret'));

		if (!secret) {
			secret = generateToken();
			await this.must(settings.set('auth_token_secret', secret));
		}

		return tokenKey(secret);
	}
}
