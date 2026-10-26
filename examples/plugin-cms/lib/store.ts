import type { PluginContext } from '@pouchbasejs/plugin-sdk/server';

import {
	slugify,
	type Category,
	type Post,
	type PostInput,
	type PostWithCategories
} from './posts.js';

/**
 * Server code of the routes: the plugin's collections through `ctx.pouch`, by their names in
 * Pouchbase (the plugin id as prefix). Only the routes import this file, never a component.
 */
export const POSTS = 'cms_posts';
export const CATEGORIES = 'cms_categories';

export function posts(ctx: PluginContext) {
	return ctx.pouch.db.$collection<Post>(POSTS);
}

export function categories(ctx: PluginContext) {
	return ctx.pouch.db.$collection<Category>(CATEGORIES);
}

/** A JSON error answer, `{ message, errors? }`, as the pages expect it. */
export function failure(status: number, message: string, errors?: Record<string, string>) {
	return Response.json(errors ? { message, errors } : { message }, { status });
}

/**
 * Routes are public: only an admin signed in to the dashboard (`ctx.admin`) may write posts. App
 * users read published posts with the records API instead, which the collection's rules allow.
 */
export function adminOnly(ctx: PluginContext) {
	return ctx.admin ? null : failure(403, 'Only admins can manage posts');
}

/** The status of an error of `ctx.pouch` (a `PouchbaseError` of the JS SDK), else 0. */
export function errorStatus(error: unknown) {
	return typeof error === 'object' && error !== null && 'status' in error
		? Number(error.status)
		: 0;
}

/**
 * `slug`, or `slug-2`, `slug-3`, … when another post has it, as WordPress does. `except` is the
 * post being saved, which may keep its own slug.
 */
export async function uniqueSlug(ctx: PluginContext, slug: string, except?: string) {
	const taken = await posts(ctx).findMany({
		where: { $or: [{ slug }, { slug: { startsWith: `${slug}-` } }] },
		select: ['id', 'slug'],
		limit: 500
	});
	const slugs = new Set(taken.items.filter((post) => post.id !== except).map((post) => post.slug));

	if (!slugs.has(slug)) {
		return slug;
	}

	let n = 2;

	while (slugs.has(`${slug}-${n}`)) {
		n++;
	}

	return `${slug}-${n}`;
}

/**
 * What is stored for a post that becomes `input`: a slug from the title when it has none (made
 * unique), and a publish date of now when it is published without one.
 */
export async function prepare(
	ctx: PluginContext,
	input: Partial<PostInput>,
	current: Post | null,
	now = new Date()
) {
	const data = { ...input };
	const title = data.title ?? current?.title ?? '';

	if (data.slug !== undefined || !current) {
		const slug = data.slug || slugFromTitle(title, current);

		data.slug = await uniqueSlug(ctx, slug, current?.id);
	}

	const status = data.status ?? current?.status;
	const publishedAt = data.published_at !== undefined ? data.published_at : current?.published_at;

	if (status === 'published' && !publishedAt) {
		data.published_at = now.toISOString();
	}

	return data;
}

function slugFromTitle(title: string, current: Post | null) {
	return slugify(title) || current?.slug || 'untitled';
}

/** A post with its categories as records, as the routes answer it; `null` when there is none. */
export async function withCategories(ctx: PluginContext, id: string) {
	const post = await posts(ctx).find(id, { include: { categories: true } });

	return post as unknown as PostWithCategories | null;
}
