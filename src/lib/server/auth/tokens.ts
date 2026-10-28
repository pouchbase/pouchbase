import { jwtVerify, SignJWT } from 'jose';

import { USERS_COLLECTION } from '#lib/auth/users.js';

/**
 * The tokens of app users: HS256 JWTs signed with the deployment's secret. Sign-in tokens and the
 * tokens of email links (one purpose each) have different audiences, so none can stand in for
 * another. Functions throw on an invalid token; the services map that to `INVALID_TOKEN`.
 */

const ISSUER = 'pouchbase';
const AUDIENCE = USERS_COLLECTION;
const LIFETIME = '7d';

/** What an email link is for; part of the token's audience. */
export type TokenPurpose = 'password_reset' | 'verification';

const PURPOSE_LIFETIMES: Record<TokenPurpose, string> = {
	password_reset: '30m',
	verification: '3d'
};

/** The claims of an email link: the address it was sent to and, for a reset, when the password last changed. */
export type PurposeClaims = { email: string; pwd?: number };

export type TokenKey = Uint8Array<ArrayBuffer>;

/** The signing key for a secret from the settings. */
export function tokenKey(secret: string): TokenKey {
	return new TextEncoder().encode(secret);
}

function sign(key: TokenKey, claims: object, subject: string, audience: string, lifetime: string) {
	return new SignJWT({ ...claims })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(subject)
		.setIssuer(ISSUER)
		.setAudience(audience)
		.setIssuedAt()
		.setExpirationTime(lifetime)
		.sign(key);
}

/** A sign-in token for the user. */
export function signUserToken(key: TokenKey, userId: string): Promise<string> {
	return sign(key, { collection: USERS_COLLECTION }, userId, AUDIENCE, LIFETIME);
}

/** The id of the user a sign-in token belongs to; throws when the token is invalid or expired. */
export async function verifyUserToken(key: TokenKey, token: string): Promise<string> {
	const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE });

	if (!payload.sub) {
		throw new Error('The token has no subject');
	}

	return payload.sub;
}

/** A token for one purpose (an email link). */
export function signPurposeToken(
	key: TokenKey,
	userId: string,
	purpose: TokenPurpose,
	claims: PurposeClaims
): Promise<string> {
	return sign(key, claims, userId, `${AUDIENCE}:${purpose}`, PURPOSE_LIFETIMES[purpose]);
}

/** The claims of an email link's token; throws when it is invalid, expired or for another purpose. */
export async function verifyPurposeToken(
	key: TokenKey,
	token: string,
	purpose: TokenPurpose
): Promise<{ sub: string; email: string; pwd: number }> {
	const { payload } = await jwtVerify(token, key, {
		issuer: ISSUER,
		audience: `${AUDIENCE}:${purpose}`
	});

	if (!payload.sub || typeof payload.email !== 'string') {
		throw new Error('The token has no subject or email');
	}

	return {
		sub: payload.sub,
		email: payload.email,
		pwd: typeof payload.pwd === 'number' ? payload.pwd : 0
	};
}
