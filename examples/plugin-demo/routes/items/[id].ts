import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * `GET /items/:id`: a `[id]` segment in the file name is a parameter, read from `ctx.params`. Any
 * value matches, e.g. `/api/plugins/demo/items/42`.
 */
export const GET: RouteHandler = async (_request, ctx) => {
	const { id } = ctx.params;

	return Response.json({
		id,
		url: `/api/plugins/${ctx.plugin.id}/items/${encodeURIComponent(id)}`
	});
};
