import { defineFunction } from '@pouchbasejs/plugin-sdk/server';

import { posts } from '../lib/store.js';

const PER_PAGE = 20;

/**
 * `cms-get-posts`, called at `/api/functions/cms-get-posts?page=2` or with
 * `pouch.functions.invoke('cms-get-posts')`: a page of the published posts whose publish date has
 * passed, sticky ones first, then the newest. `ctx.pouch` doesn't apply the collection's API rules,
 * so this checks the same conditions itself.
 */
export default defineFunction({
	description: 'A page of the published posts, sticky ones first, then the newest.',
	handler: async (request, ctx) => {
		const url = new URL(request.url);
		const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
		const list = await posts(ctx).findMany({
			where: { status: 'published', published_at: { lte: new Date().toISOString() } },
			orderBy: { sticky: 'desc', published_at: 'desc' },
			include: { categories: true },
			limit: PER_PAGE,
			offset: (page - 1) * PER_PAGE
		});

		return Response.json({ items: list.items, total: list.total, page, perPage: PER_PAGE });
	}
});
