import type { AuthError } from './auth.service';
import type { OAuthProvider } from '#lib/auth/oauth-providers.js';
import type { OAuthCredentials } from '../oauth';
import type { OAuthProviderDetails } from '../oauth-settings';
import type { OAuthProfile } from '@pouchbasejs/plugin-sdk/server';
import type { ResultAsync } from 'neverthrow';

import { eq, lt, type SQL } from 'drizzle-orm';

import { oauthCallbackPath } from '#lib/auth/oauth-providers.js';

import { queryDatabase } from '../db/query';
import { generateRecordId } from '../crypto';
import { oauthRequests } from '../db';
import { authorizationUrl, exchangeCode, randomToken } from '../oauth';
import { parseProfile } from '../plugins/runtime';
import { Failure, Service } from './base.service';
import { decideSignIn, normalizeEmail } from '../auth/sign-in';

/** How long a sign-in may take, from opening the popup to collecting the token. */
const OAUTH_REQUEST_TTL = 10 * 60 * 1000;

/** Error codes an app can receive for a failed sign-in. */
export type OAuthErrorCode = 'access_denied' | 'email_in_use' | 'sign_in_failed';

export type OAuthResult =
	| { status: 'pending' }
	| { status: 'done'; token: string; userId: string }
	| { status: 'error'; error: OAuthErrorCode };

/** `state` chosen by the app: random, URL-safe. */
const CLIENT_STATE = /^[A-Za-z0-9_-]{16,128}$/;
/** S256 PKCE challenge: base64url of a SHA-256 hash. */
const CLIENT_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
/** PKCE verifier (RFC 7636). */
const CLIENT_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

async function s256(verifier: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));

	return btoa(String.fromCharCode(...new Uint8Array(digest)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

/**
 * Signing in with a provider (Google, GitHub, ...) in a popup. The app chooses a `state` and the
 * S256 `challenge` of a secret verifier; only whoever knows that verifier can collect the token
 * later (`result`). Pouchbase uses its own state and PKCE verifier towards the provider.
 */
export class OAuthService extends Service {
	/**
	 * Starts a sign-in.
	 *
	 * @returns The provider's authorization URL to send the popup to.
	 */
	start(
		provider: OAuthProvider,
		clientState: string,
		clientChallenge: string
	): ResultAsync<string, AuthError> {
		return this.run(
			async () => {
				if (!CLIENT_STATE.test(clientState) || !CLIENT_CHALLENGE.test(clientChallenge)) {
					this.fail(11010, 'INVALID_OAUTH_REQUEST');
				}

				const { details, credentials } = await this.enabledProvider(provider);

				// Clean up abandoned sign-ins on the way.
				await this.db.delete(oauthRequests).where(lt(oauthRequests.expiresAt, new Date()));

				const [existing] = await this.db
					.select({ id: oauthRequests.id })
					.from(oauthRequests)
					.where(eq(oauthRequests.clientState, clientState));

				if (existing) {
					this.fail(11010, 'INVALID_OAUTH_REQUEST');
				}

				const id = randomToken();
				const providerVerifier = randomToken();

				await this.db.insert(oauthRequests).values({
					id,
					provider,
					clientState,
					clientChallenge,
					providerVerifier,
					expiresAt: new Date(Date.now() + OAUTH_REQUEST_TTL)
				});

				return (
					await authorizationUrl(details.config, credentials, id, providerVerifier)
				).toString();
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/**
	 * Handles the provider's callback: signs the user in and stores the token (or an error code) on
	 * the request, for the app to collect with `result`.
	 *
	 * @param providerError The provider's `error` parameter, e.g. when the user declined.
	 */
	finish(
		provider: OAuthProvider,
		state: string,
		code: string | null,
		providerError: string | null
	): ResultAsync<{ status: 'done' } | { status: 'error'; error: OAuthErrorCode }, AuthError> {
		return this.run(
			async () => {
				const request = await this.findRequest(eq(oauthRequests.id, state));

				if (!request || request.provider !== provider || request.status !== 'pending') {
					this.fail(11011, 'OAUTH_REQUEST_NOT_FOUND');
				}

				const outcome = code
					? await this.signIn(provider, code, request.providerVerifier)
					: ({
							error: providerError === 'access_denied' ? 'access_denied' : 'sign_in_failed'
						} as const);

				await this.db
					.update(oauthRequests)
					.set(
						'error' in outcome
							? { status: 'error', error: outcome.error }
							: { status: 'done', token: outcome.token, userId: outcome.userId }
					)
					.where(eq(oauthRequests.id, request.id));

				return 'error' in outcome ? { status: 'error', error: outcome.error } : { status: 'done' };
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/**
	 * The outcome of a sign-in, for the app that started it. The verifier must match the challenge
	 * sent to `start`; a finished result is handed out once and then deleted.
	 */
	result(clientState: string, verifier: string): ResultAsync<OAuthResult, AuthError> {
		return this.run(
			async () => {
				if (!CLIENT_STATE.test(clientState) || !CLIENT_VERIFIER.test(verifier)) {
					this.fail(11012, 'INVALID_VERIFIER');
				}

				const request = await this.findRequest(eq(oauthRequests.clientState, clientState));

				if (!request) {
					this.fail(11011, 'OAUTH_REQUEST_NOT_FOUND');
				}

				if ((await s256(verifier)) !== request.clientChallenge) {
					this.fail(11012, 'INVALID_VERIFIER');
				}

				if (request.status === 'pending') {
					return { status: 'pending' };
				}

				const result: OAuthResult =
					request.status === 'done' && request.token && request.userId
						? { status: 'done', token: request.token, userId: request.userId }
						: { status: 'error', error: (request.error ?? 'sign_in_failed') as OAuthErrorCode };

				await this.db.delete(oauthRequests).where(eq(oauthRequests.id, request.id));

				return result;
			},
			(error) => this.error(11000, 'AUTH_FAILED', error)
		);
	}

	/**
	 * Exchanges the code, finds or creates the user and returns a token; or the error code for the
	 * app when that fails. Failures other than a conflicting email are logged: the app only learns
	 * that the sign-in failed.
	 */
	private async signIn(
		provider: OAuthProvider,
		code: string,
		codeVerifier: string
	): Promise<{ token: string; userId: string } | { error: OAuthErrorCode }> {
		try {
			return await this.login(provider, code, codeVerifier);
		} catch (error) {
			if (error instanceof Failure && error.error.code === 11005) {
				return { error: 'email_in_use' };
			}

			console.error(
				`[auth] Sign-in with ${provider} failed`,
				error instanceof Failure ? error.error : error
			);

			return { error: 'sign_in_failed' };
		}
	}

	/**
	 * A sign-in is linked to an existing user with the same email only when the provider verified
	 * that email; otherwise anyone could take over an account by claiming its address.
	 */
	private async login(provider: OAuthProvider, code: string, codeVerifier: string) {
		const auth = this.services.auth();
		const { details, credentials } = await this.enabledProvider(provider);
		const accessToken = await exchangeCode(details.config, credentials, code, codeVerifier);
		const profile = await this.loadProfile(details, credentials, accessToken);

		await this.must(auth.ensureUsersCollection());

		const databaseId = await auth.appDatabaseId();
		const email = normalizeEmail(profile.email);
		const decision = decideSignIn(
			{ email, emailVerified: profile.emailVerified },
			{
				linkedUserId: await this.linkedUser(databaseId, provider, profile.id),
				emailOwnerId: email ? await this.emailOwner(databaseId, email) : null
			}
		);

		if (decision.action === 'conflict') {
			this.fail(11005, 'EMAIL_IN_USE');
		}

		let userId: string;

		if (decision.action === 'sign-in') {
			userId = decision.userId;
		} else {
			userId = decision.action === 'link' ? decision.userId : generateRecordId();

			if (decision.action === 'create') {
				const now = Date.now();

				await queryDatabase(
					databaseId,
					`INSERT INTO "users" ("id", "created_at", "updated_at", "email", "name", "verified") VALUES (?, ?, ?, ?, ?, ?)`,
					[userId, now, now, email, profile.name, profile.emailVerified ? 1 : 0]
				);
			}

			await queryDatabase(
				databaseId,
				`INSERT INTO "_external_auths" ("id", "user_id", "provider", "provider_id", "created_at") VALUES (?, ?, ?, ?, ?)`,
				[generateRecordId(), userId, provider, profile.id, Date.now()]
			);

			if (decision.action === 'create') {
				await auth.signedUp(userId);

				if (profile.avatarUrl) {
					await this.importAvatar(userId, profile.avatarUrl);
				}
			}
		}

		return { token: await this.must(auth.signToken(userId)), userId };
	}

	/** The user this provider account was linked to; a link to a deleted user is dropped. */
	private async linkedUser(databaseId: string, provider: OAuthProvider, providerId: string) {
		const [link] = await queryDatabase(
			databaseId,
			`SELECT "user_id" FROM "_external_auths" WHERE "provider" = ? AND "provider_id" = ?`,
			[provider, providerId]
		);

		if (!link) {
			return null;
		}

		const [user] = await queryDatabase(databaseId, `SELECT "id" FROM "users" WHERE "id" = ?`, [
			link[0]
		]);

		if (user) {
			return String(user[0]);
		}

		// The user was deleted; drop the stale link and sign up again.
		await queryDatabase(
			databaseId,
			`DELETE FROM "_external_auths" WHERE "provider" = ? AND "provider_id" = ?`,
			[provider, providerId]
		);

		return null;
	}

	private async emailOwner(databaseId: string, email: string) {
		const [existing] = await queryDatabase(
			databaseId,
			`SELECT "id" FROM "users" WHERE "email" = ?`,
			[email]
		);

		return existing ? String(existing[0]) : null;
	}

	/**
	 * Stores the provider's profile picture in `files` and links it as the user's avatar.
	 * Best effort: a sign-in never fails because of its avatar.
	 */
	private async importAvatar(userId: string, url: string) {
		try {
			const file = await this.must(this.services.files().importImage(url, `avatar-${userId}`));

			if (!file) {
				return;
			}

			await queryDatabase(
				await this.services.auth().appDatabaseId(),
				`UPDATE "users" SET "avatar" = ? WHERE "id" = ?`,
				[file.id, userId]
			);
			this.services.auth().announce('update', userId);
		} catch (error) {
			console.error(`[auth] Could not import the avatar of ${userId}`, error);
		}
	}

	/** A sign-in that hasn't expired yet; `null` otherwise. */
	private async findRequest(where: SQL) {
		const [request] = await this.db.select().from(oauthRequests).where(where);

		return request && request.expiresAt > new Date() ? request : null;
	}

	/** The provider's plugin and OAuth config, with the credentials, when it can be used. */
	private async enabledProvider(
		provider: OAuthProvider
	): Promise<{ details: OAuthProviderDetails; credentials: OAuthCredentials }> {
		const details = await this.must(this.services.oauthProviders().find(provider));

		if (!details) {
			this.fail(11014, 'PROVIDER_NOT_FOUND');
		}

		const { enabled, clientId, clientSecret } = details.credentials;

		if (!enabled || !clientId || !clientSecret) {
			this.fail(11001, 'PROVIDER_NOT_ENABLED');
		}

		return {
			details,
			credentials: { clientId, clientSecret, redirectUri: this.callbackUrl(provider) }
		};
	}

	/** Asks the provider's plugin for the user behind the access token, and checks the answer. */
	private async loadProfile(
		details: OAuthProviderDetails,
		credentials: OAuthCredentials,
		accessToken: string
	): Promise<OAuthProfile> {
		const runtime = await this.must(this.services.plugins().runtimeFor(details.pluginId));

		if (!runtime) {
			throw new Error(`The plugin ${details.pluginId} has no server code`);
		}

		return parseProfile(
			await runtime.call({
				type: 'profile',
				provider: details.provider,
				accessToken,
				credentials: { clientId: credentials.clientId }
			})
		);
	}

	/**
	 * Callback URL registered at the provider, for this deployment (the settings page shows the
	 * same one). Reads the request URL, so it can't be used inside a remote `query`.
	 */
	private callbackUrl(provider: OAuthProvider) {
		return new URL(oauthCallbackPath(provider), this.ctx.url.origin).toString();
	}
}
