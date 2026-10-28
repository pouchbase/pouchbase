/**
 * Helpers for the auth providers of a plugin: `fetchJson` for a provider's API and
 * `createOidcProvider` for an OpenID Connect provider. Only types are imported, so it bundles into
 * the sandboxed server code as is.
 */

import type { AuthProviderHandler, OAuthProfile, PluginContext } from './server.js';

/**
 * GETs JSON from an API with the user's access token, through `ctx.fetch`; for the profile of
 * an auth provider, e.g. `fetchJson<GitHubUser>(ctx, 'https://api.github.com/user', token)`.
 * Sends `Authorization: Bearer <token>`, `Accept: application/json` and a `User-Agent` (some
 * APIs require one); `headers` adds to or overrides them. Throws when the response is not 2xx.
 */
export async function fetchJson<T>(
	ctx: Pick<PluginContext, 'fetch'>,
	url: string,
	accessToken: string,
	headers: Record<string, string> = {}
): Promise<T> {
	const response = await ctx.fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json',
			'User-Agent': 'Pouchbase',
			...headers
		}
	});

	if (!response.ok) {
		throw new Error(`Request failed (${response.status}): ${url}`);
	}

	return (await response.json()) as T;
}

/** The standard claims of an OpenID Connect userinfo response, plus whatever else it has. */
export type OidcClaims = {
	sub: string;
	email?: string;
	/** Some providers send it as a string. */
	email_verified?: boolean | string;
	name?: string;
	preferred_username?: string;
	picture?: string;
	[claim: string]: unknown;
};

export type OidcProviderOptions = {
	authorizeUrl: string;
	tokenUrl: string;
	/** The provider's OpenID Connect userinfo endpoint. */
	userinfoUrl: string;
	/** Default `['openid', 'email', 'profile']`. */
	scopes?: string[];
	/** Send a PKCE code challenge; default `true`. */
	pkce?: boolean;
	/**
	 * Adjusts the profile mapped from the standard claims, e.g. to distrust `email_verified` or
	 * to read a custom claim. Missing returns `profile` as is.
	 */
	mapProfile?(
		claims: OidcClaims,
		profile: OAuthProfile,
		ctx: PluginContext
	): OAuthProfile | Promise<OAuthProfile>;
};

/**
 * An auth provider for an OpenID Connect provider: its profile comes from the userinfo endpoint
 * (`sub`, `email`, `email_verified`, `name`, `picture`).
 *
 * ```ts
 * export default definePlugin({
 * 	authProviders: {
 * 		google: createOidcProvider({
 * 			authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
 * 			tokenUrl: 'https://oauth2.googleapis.com/token',
 * 			userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo'
 * 		})
 * 	}
 * });
 * ```
 *
 * The host of `userinfoUrl` must be in `permissions.network`.
 */
export function createOidcProvider(options: OidcProviderOptions): AuthProviderHandler {
	return {
		authorizeUrl: options.authorizeUrl,
		tokenUrl: options.tokenUrl,
		scopes: options.scopes ?? ['openid', 'email', 'profile'],
		pkce: options.pkce ?? true,
		async profile(accessToken, _credentials, ctx) {
			const claims = await fetchJson<OidcClaims>(ctx, options.userinfoUrl, accessToken);

			if (typeof claims?.sub !== 'string' || !claims.sub) {
				throw new Error(`The userinfo response has no sub claim: ${options.userinfoUrl}`);
			}

			const email = typeof claims.email === 'string' && claims.email ? claims.email : null;
			const profile: OAuthProfile = {
				id: claims.sub,
				email,
				emailVerified:
					email !== null && (claims.email_verified === true || claims.email_verified === 'true'),
				name: claims.name || claims.preferred_username || null,
				avatarUrl: typeof claims.picture === 'string' && claims.picture ? claims.picture : null
			};

			return options.mapProfile ? options.mapProfile(claims, profile, ctx) : profile;
		}
	};
}
