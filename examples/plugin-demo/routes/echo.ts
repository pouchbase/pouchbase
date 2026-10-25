import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * `POST /echo`: reads a JSON body and answers 422 when it isn't what the route expects. The
 * `max_length` setting comes back as a number and `shout` as a boolean, typed by `plugin.ts`.
 */
export const POST: RouteHandler = async (request, ctx) => {
	const body: unknown = await request.json().catch(() => null);
	const message =
		body && typeof body === 'object' && 'message' in body
			? (body as { message: unknown }).message
			: null;

	if (typeof message !== 'string' || !message.trim()) {
		return Response.json({ error: 'Send { "message": "..." }' }, { status: 422 });
	}

	const maxLength = await ctx.settings.get('max_length');
	const text = message.trim();

	if (text.length > maxLength) {
		return Response.json({ error: `Send at most ${maxLength} characters` }, { status: 422 });
	}

	const shout = await ctx.settings.get('shout');

	return Response.json({ message: shout ? text.toUpperCase() : text, length: text.length });
};
