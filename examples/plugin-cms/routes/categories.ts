import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

import { slugify } from '../lib/posts.js';
import { adminOnly, categories, failure } from '../lib/store.js';

/** `GET /categories`: every category, by name, for the editor's Categories panel. */
export const GET: RouteHandler = async (_request, ctx) => {
	const denied = adminOnly(ctx);

	if (denied) {
		return denied;
	}

	const all = await categories(ctx).findAll({ orderBy: { name: 'asc' } });

	return Response.json(all);
};

/** `POST /categories` with `{ name }`: adds a category, or answers the one with the same slug. */
export const POST: RouteHandler = async (request, ctx) => {
	const denied = adminOnly(ctx);

	if (denied) {
		return denied;
	}

	const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
	const name = typeof body?.name === 'string' ? body.name.trim() : '';
	const slug = slugify(name);

	if (!name || !slug) {
		return failure(422, 'Give the category a name', { name: 'Required' });
	}

	const existing = await categories(ctx).findFirst({ where: { slug } });

	if (existing) {
		return Response.json(existing);
	}

	return Response.json(await categories(ctx).insert({ name, slug }), { status: 201 });
};
