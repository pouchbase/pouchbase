import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

import { parsePostInput } from '../lib/posts.js';
import { adminOnly, failure, posts, prepare, withCategories } from '../lib/store.js';

/** `GET /posts/:id`: the post for the editor, with its categories. */
export const GET: RouteHandler = async (_request, ctx) => {
	const denied = adminOnly(ctx);

	if (denied) {
		return denied;
	}

	const post = await withCategories(ctx, ctx.params.id ?? '');

	return post ? Response.json(post) : failure(404, 'This post does not exist');
};

/**
 * `PATCH /posts/:id` with some fields of a `PostInput`: saves them. Trashing and restoring a post
 * are a change of `status` too.
 */
export const PATCH: RouteHandler = async (request, ctx) => {
	const denied = adminOnly(ctx);

	if (denied) {
		return denied;
	}

	const id = ctx.params.id ?? '';
	const current = await posts(ctx).find(id);

	if (!current) {
		return failure(404, 'This post does not exist');
	}

	const parsed = parsePostInput(await request.json().catch(() => null), { partial: true });

	if (!parsed.ok) {
		return failure(422, 'Check the post', parsed.errors);
	}

	await posts(ctx).patch(id, await prepare(ctx, parsed.value, current));

	return Response.json(await withCategories(ctx, id));
};

/** `DELETE /posts/:id`: deletes a post for good; the list only offers it for posts in the trash. */
export const DELETE: RouteHandler = async (_request, ctx) => {
	const denied = adminOnly(ctx);

	if (denied) {
		return denied;
	}

	const id = ctx.params.id ?? '';

	if (!(await posts(ctx).find(id, { select: ['id'] }))) {
		return failure(404, 'This post does not exist');
	}

	await posts(ctx).remove(id);

	return new Response(null, { status: 204 });
};
