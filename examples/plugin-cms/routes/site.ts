import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * `GET /site`: the `site_url` setting, so the editor can show a post's permalink and link to it.
 * `null` while an admin hasn't set it.
 */
export const GET: RouteHandler = async (_request, ctx) => {
	const url = await ctx.settings.get('site_url');

	return Response.json({ url: url ? url.replace(/\/+$/, '') : null });
};
