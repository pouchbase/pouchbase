import type { AuthError } from './auth.service';
import type { ResultAsync } from 'neverthrow';

import {
	appPassword,
	passwordRegisterSchema,
	type PasswordRegisterInput
} from '#lib/schemas/password-auth.js';

import { queryDatabase } from '../db/query';
import { generateRecordId, hashPassword, verifyPassword } from '../crypto';
import { Service } from './base.service';
import { issuesByField } from '../auth/users-table';

export type PasswordSettings = {
	enabled: boolean;
	/** Whether new users may sign up themselves; otherwise only admins create them. */
	signUp: boolean;
	/** Whether users must verify their email address before they can sign in with a password. */
	requireVerification: boolean;
};

/** A new user; `token` is `null` when they must verify their email address first. */
export type PasswordRegisterResult = { token: string | null; userId: string };

/** Signing in with an email address and a password. Hashes live in `_passwords`, never in `users`. */
export class PasswordAuthService extends Service {
	settings(): ResultAsync<PasswordSettings, AuthError> {
		return this.services
			.settings()
			.getMany(['auth_password_enabled', 'auth_password_signup', 'auth_password_verify'])
			.map((values) => ({
				enabled: values.auth_password_enabled === 'true',
				signUp: values.auth_password_signup === 'true',
				requireVerification: values.auth_password_verify === 'true'
			}));
	}

	updateSettings(input: PasswordSettings): ResultAsync<void, AuthError> {
		return this.run(
			async () => {
				const settings = this.services.settings();

				await this.must(settings.set('auth_password_enabled', String(input.enabled)));
				await this.must(settings.set('auth_password_signup', String(input.signUp)));
				await this.must(settings.set('auth_password_verify', String(input.requireVerification)));
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/**
	 * Creates an app user with a name, email and password, and returns a token. When verification
	 * is required there is no token: the user signs in after following the link in the
	 * verification email.
	 */
	register(input: PasswordRegisterInput): ResultAsync<PasswordRegisterResult, AuthError> {
		return this.run(
			async () => {
				const auth = this.services.auth();
				const settings = await this.must(this.settings());

				if (!settings.enabled) {
					this.fail(11020, 'PASSWORD_AUTH_DISABLED');
				}

				if (!settings.signUp) {
					this.fail(11021, 'SIGN_UP_DISABLED');
				}

				const parsed = passwordRegisterSchema.safeParse(input);

				if (!parsed.success) {
					this.fail(11025, 'INVALID_INPUT', {
						data: { issues: issuesByField(parsed.error.issues) }
					});
				}

				// Without mail, nobody could ever verify their address and sign in.
				if (settings.requireVerification) {
					await auth.requireMail();
				}

				await this.must(auth.ensureUsersCollection());

				const databaseId = await auth.appDatabaseId();
				const { email, name, password } = parsed.data;
				const [taken] = await queryDatabase(
					databaseId,
					`SELECT "id" FROM "users" WHERE "email" = ?`,
					[email]
				);

				if (taken) {
					this.fail(11024, 'EMAIL_TAKEN');
				}

				const userId = generateRecordId();
				const now = Date.now();

				await queryDatabase(
					databaseId,
					`INSERT INTO "users" ("id", "created_at", "updated_at", "email", "name", "verified") VALUES (?, ?, ?, ?, ?, 0)`,
					[userId, now, now, email, name]
				);
				await queryDatabase(
					databaseId,
					`INSERT INTO "_passwords" ("user_id", "hash", "updated_at") VALUES (?, ?, ?)`,
					[userId, await hashPassword(password), now]
				);
				await auth.signedUp(userId);

				return {
					token: settings.requireVerification ? null : await this.must(auth.signToken(userId)),
					userId
				};
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/**
	 * Checks an email and password, and returns a token. When verification is required, a user
	 * whose address isn't verified yet gets `EMAIL_NOT_VERIFIED`, but only with the right password.
	 */
	login(
		email: string,
		password: string
	): ResultAsync<{ token: string; userId: string }, AuthError> {
		return this.run(
			async () => {
				const auth = this.services.auth();
				const settings = await this.must(this.settings());

				if (!settings.enabled) {
					this.fail(11020, 'PASSWORD_AUTH_DISABLED');
				}

				const [row] = await queryDatabase(
					await auth.appDatabaseId(),
					`SELECT "users"."id", "_passwords"."hash", "users"."verified" FROM "users" JOIN "_passwords" ON "_passwords"."user_id" = "users"."id" WHERE "users"."email" = ?`,
					[email.trim().toLowerCase()]
				);

				if (!row) {
					// Hash anyway, so unknown users take as long as wrong passwords.
					await hashPassword(password);
					this.fail(11022, 'INVALID_CREDENTIALS');
				}

				if (!(await verifyPassword(password, String(row[1])))) {
					this.fail(11022, 'INVALID_CREDENTIALS');
				}

				if (settings.requireVerification && !Number(row[2])) {
					this.fail(11032, 'EMAIL_NOT_VERIFIED');
				}

				const userId = String(row[0]);

				return { token: await this.must(auth.signToken(userId)), userId };
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/** Sets (or replaces) the password of an app user; used by admins. */
	setPassword(userId: string, password: string): ResultAsync<void, AuthError> {
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

				await queryDatabase(
					await this.services.auth().appDatabaseId(),
					`INSERT INTO "_passwords" ("user_id", "hash", "updated_at") VALUES (?, ?, ?) ON CONFLICT ("user_id") DO UPDATE SET "hash" = excluded."hash", "updated_at" = excluded."updated_at"`,
					[userId, await hashPassword(parsed.data), Date.now()]
				);
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}
}
