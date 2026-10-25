import { defineAuthProvider, fetchJson } from '@pouchbasejs/plugin-sdk/server';

import logo from './icon.svg';

type GitHubUser = { id: number; login: string; name: string | null; avatar_url: string | null };

type GitHubEmail = { email: string; primary: boolean; verified: boolean };

export default defineAuthProvider({
	label: 'GitHub',
	icon: logo,
	consoleUrl: 'https://github.com/settings/developers',
	authorizeUrl: 'https://github.com/login/oauth/authorize',
	tokenUrl: 'https://github.com/login/oauth/access_token',
	scopes: ['read:user', 'user:email'],
	pkce: false,
	async profile(accessToken, _credentials, ctx) {
		// The user's email may be private, so it comes from the emails endpoint (scope user:email).
		const [user, emails] = await Promise.all([
			fetchJson<GitHubUser>(ctx, 'https://api.github.com/user', accessToken),
			fetchJson<GitHubEmail[]>(ctx, 'https://api.github.com/user/emails', accessToken)
		]);
		const primary = emails.find((email) => email.primary) ?? emails[0];

		return {
			id: String(user.id),
			email: primary?.email ?? null,
			emailVerified: primary?.verified === true,
			name: user.name ?? user.login,
			avatarUrl: user.avatar_url
		};
	}
});
