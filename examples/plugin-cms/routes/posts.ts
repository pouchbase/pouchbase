import type { Where } from '@pouchbasejs/js-sdk';
import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

import {
	parsePostInput,
	POST_STATUSES,
	type Post,
	type PostCounts,
	type PostFilter,
	type PostList,
	type PostWithCategories
} from '../lib/posts.js';
import { adminOnly, failure, posts, prepare, withCategories } from '../lib/store.js';

const PER_PAGE = 20;

const FILTERS: readonly PostFilter[] = ['all', ...POST_STATUSES];

/** The posts of a tab of the list: `all` is every post that isn't in the trash. */
function filterWhere(filter: PostFilter): Where<Post> {
	return filter === 'all' ? { status: { not: 'trash' } } : { status: filter };
}

/**
 * `GET /posts?status=draft&q=hello&page=2`: a page of posts for the list, newest first, with their
 * categories, and how many posts each tab has.
 */
export const GET: RouteHandler = async (request, ctx) => {
	const denied = adminOnly(ctx);

	if (denied) {
		return denied;
	}

	const url = new URL(request.url);
	const status = (url.searchParams.get('status') ?? 'all') as PostFilter;
	const q = url.searchParams.get('q')?.trim() ?? '';
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	if (!FILTERS.includes(status)) {
		return failure(422, `status is one of ${FILTERS.join(', ')}`);
	}

	const where: Where<Post> = q
		? { ...filterWhere(status), title: { contains: q } }
		: filterWhere(status);

	const [list, ...counts] = await Promise.all([
		posts(ctx).findMany({
			where,
			orderBy: { created_at: 'desc' },
			include: { categories: true },
			limit: PER_PAGE,
			offset: (page - 1) * PER_PAGE
		}),
		...FILTERS.map((filter) => posts(ctx).count(filterWhere(filter)))
	]);

	const body: PostList = {
		items: list.items as unknown as PostWithCategories[],
		total: list.total,
		page,
		perPage: PER_PAGE,
		counts: Object.fromEntries(FILTERS.map((filter, i) => [filter, counts[i]])) as PostCounts
	};

	return Response.json(body);
};

/** `POST /posts` with a `PostInput`: adds a post and answers it, with a unique slug. */
export const POST: RouteHandler = async (request, ctx) => {
	const denied = adminOnly(ctx);

	if (denied) {
		return denied;
	}

	const parsed = parsePostInput(await request.json().catch(() => null), { partial: false });

	if (!parsed.ok) {
		return failure(422, 'Check the post', parsed.errors);
	}

	const data = await prepare(ctx, parsed.value, null);
	const created = await posts(ctx).insert(data);

	return Response.json(await withCategories(ctx, created.id), { status: 201 });
};
