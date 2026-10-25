import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/** A record of the notes collection. */
type Note = { id: string; text: string; author: string; created_at: string; updated_at: string };

/** The notes collection, by its name in Pouchbase: the plugin id as prefix. */
const NOTES = 'demo_notes';

/**
 * `GET /notes`: the signed-in user's notes, newest first, with their author. `ctx.pouch` is the JS
 * SDK, signed in as the plugin: it reaches `demo_notes` because the plugin adds it, and `users`
 * (for `include`) because `pouchbase-plugin.json` asks to read it. API rules don't apply to the
 * plugin, so it checks `ctx.user` itself.
 */
export const GET: RouteHandler = async (_request, ctx) => {
	if (!ctx.user) {
		return Response.json({ message: 'Sign in to see your notes' }, { status: 401 });
	}

	const notes = await ctx.pouch.db.$collection<Note>(NOTES).findMany({
		where: { author: { eq: ctx.user.id } },
		orderBy: { created_at: 'desc' },
		include: { author: true },
		limit: 20
	});

	return Response.json(notes);
};

/** `POST /notes` with `{ text }`: adds a note of the signed-in user. */
export const POST: RouteHandler = async (request, ctx) => {
	if (!ctx.user) {
		return Response.json({ message: 'Sign in to add a note' }, { status: 401 });
	}

	const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
	const text = typeof body?.text === 'string' ? body.text.trim() : '';

	if (!text) {
		return Response.json({ message: 'Send { "text": "..." }' }, { status: 422 });
	}

	const note = await ctx.pouch.db.$collection<Note>(NOTES).insert({ text, author: ctx.user.id });

	return Response.json(note, { status: 201 });
};
