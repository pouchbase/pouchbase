import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * `GET /me`: the app user who made the request. Pouchbase fills `ctx.user` from the request's
 * bearer token (a token from `pouch.auth.login()`); without one it is `null`, and an invalid or
 * expired token never reaches the plugin (Pouchbase answers 401 itself).
 */
export const GET: RouteHandler = async (_request, ctx) => {
	if (!ctx.user) {
		return Response.json(
			{ error: 'Sign in as an app user and send the token as Authorization: Bearer <token>' },
			{ status: 401 }
		);
	}

	const { id, email, name, verified } = ctx.user;

	return Response.json({ id, email, name, verified });
};
