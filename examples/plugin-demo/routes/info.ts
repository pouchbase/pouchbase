import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * `GET /info`: who the plugin is, and its settings. `ctx.settings.get(key)` returns what an admin
 * saved on the Plugins page, else the setting's default from `plugin.ts`, and `getAll()` all of
 * them; both are typed by the `Register` block there, so `greeting` is a `string` (it has a
 * default) and a key that `plugin.ts` doesn't declare is a type error.
 */
export const GET: RouteHandler = async (_request, ctx) => {
	const settings = await ctx.settings.getAll();

	ctx.log.info('Info requested');

	return Response.json({
		id: ctx.plugin.id,
		version: ctx.plugin.version,
		greeting: settings.greeting,
		settings,
		// Whether an admin signed in to the dashboard made the request (always false from curl).
		admin: ctx.admin
	});
};
