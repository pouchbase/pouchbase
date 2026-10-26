/**
 * The post model, shared by the routes and the pages. No server imports, so the components can
 * import it too (as `../lib/posts.js`).
 */

/** Where a post is in its life; `trash` posts can be restored or deleted for good. */
export const POST_STATUSES = ['draft', 'pending', 'published', 'trash'] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

/** The statuses an author picks in the editor; trashing is a separate action. */
export const STATUS_LABELS: Record<PostStatus, string> = {
	draft: 'Draft',
	pending: 'Pending review',
	published: 'Published',
	trash: 'Trash'
};

export type Category = { id: string; name: string; slug: string };

/** A record of `cms_posts`, as the records API returns it. */
export type Post = {
	id: string;
	title: string | null;
	slug: string;
	content: string | null;
	excerpt: string | null;
	status: PostStatus;
	/** ISO 8601; in the future for a scheduled post, `null` for a draft that was never published. */
	published_at: string | null;
	featured_image: string | null;
	sticky: boolean;
	categories: string[];
	tags: string[] | null;
	created_at: string;
	updated_at: string;
};

/** A post with its categories as records, as `GET /posts` and `GET /posts/:id` answer. */
export type PostWithCategories = Omit<Post, 'categories'> & { categories: Category[] };

/** What the editor sends to `POST /posts` and `PATCH /posts/:id`. */
export type PostInput = {
	title: string;
	slug: string;
	content: string;
	excerpt: string;
	status: PostStatus;
	published_at: string | null;
	featured_image: string | null;
	sticky: boolean;
	categories: string[];
	tags: string[];
};

/** What the editor's sidebar edits: everything of a post but its content. */
export type PostFields = Omit<PostInput, 'content'>;

/** The tabs of the posts list: every status but trash, or one of them. */
export type PostFilter = 'all' | PostStatus;

export type PostCounts = Record<PostFilter, number>;

/** What `GET /posts` answers. */
export type PostList = {
	items: PostWithCategories[];
	total: number;
	page: number;
	perPage: number;
	counts: PostCounts;
};

export const MAX_TAGS = 20;

/** `Hello, World!` → `hello-world`; accents are dropped (`Crème brûlée` → `creme-brulee`). */
export function slugify(text: string) {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/, '');
}

/** A published post whose publish date is still ahead. */
export function isScheduled(post: Pick<Post, 'status' | 'published_at'>, now = new Date()) {
	return (
		post.status === 'published' &&
		post.published_at !== null &&
		Date.parse(post.published_at) > now.getTime()
	);
}

/** The status as the posts list and the editor show it, with scheduled posts apart. */
export function statusLabel(post: Pick<Post, 'status' | 'published_at'>, now = new Date()) {
	return isScheduled(post, now) ? 'Scheduled' : STATUS_LABELS[post.status];
}

type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * Checks a body of `POST /posts` (`partial: false`, missing fields get their defaults) or `PATCH
 * /posts/:id` (`partial: true`, only the fields it has). Strings are trimmed, tags deduplicated;
 * the slug isn't made unique here (see `uniqueSlug` of the routes).
 */
export function parsePostInput(
	body: unknown,
	{ partial }: { partial: boolean }
): Parsed<Partial<PostInput>> {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { ok: false, errors: { body: 'Send a JSON object' } };
	}

	const input = body as Record<string, unknown>;
	const value: Partial<PostInput> = {};
	const errors: Record<string, string> = {};
	const has = (key: keyof PostInput) => key in input && input[key] !== undefined;

	for (const key of ['title', 'content', 'excerpt'] as const) {
		if (has(key)) {
			if (isString(input[key])) {
				value[key] = key === 'content' ? input[key] : input[key].trim();
			} else {
				errors[key] = 'Must be text';
			}
		} else if (!partial) {
			value[key] = '';
		}
	}

	if (has('slug')) {
		const slug = isString(input.slug) ? slugify(input.slug) : '';

		if (isString(input.slug) && (slug || !input.slug.trim())) {
			value.slug = slug;
		} else {
			errors.slug = 'Use letters, numbers and dashes';
		}
	} else if (!partial) {
		value.slug = '';
	}

	if (has('status')) {
		if ((POST_STATUSES as readonly unknown[]).includes(input.status)) {
			value.status = input.status as PostStatus;
		} else {
			errors.status = `One of ${POST_STATUSES.join(', ')}`;
		}
	} else if (!partial) {
		value.status = 'draft';
	}

	if (has('published_at')) {
		if (input.published_at === null || input.published_at === '') {
			value.published_at = null;
		} else if (isString(input.published_at) && !Number.isNaN(Date.parse(input.published_at))) {
			value.published_at = new Date(input.published_at).toISOString();
		} else {
			errors.published_at = 'Enter a valid date';
		}
	} else if (!partial) {
		value.published_at = null;
	}

	if (has('featured_image')) {
		const url = isString(input.featured_image) ? input.featured_image.trim() : null;

		if (!url) {
			value.featured_image = null;
		} else if (/^https?:\/\//.test(url) && URL.canParse(url)) {
			value.featured_image = url;
		} else {
			errors.featured_image = 'Enter an http(s) URL';
		}
	} else if (!partial) {
		value.featured_image = null;
	}

	if (has('sticky')) {
		if (typeof input.sticky === 'boolean') {
			value.sticky = input.sticky;
		} else {
			errors.sticky = 'Must be true or false';
		}
	} else if (!partial) {
		value.sticky = false;
	}

	if (has('categories')) {
		if (Array.isArray(input.categories) && input.categories.every(isString)) {
			value.categories = [...new Set(input.categories)];
		} else {
			errors.categories = 'Must be a list of category ids';
		}
	} else if (!partial) {
		value.categories = [];
	}

	if (has('tags')) {
		if (Array.isArray(input.tags) && input.tags.every(isString)) {
			const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];

			if (tags.length > MAX_TAGS) {
				errors.tags = `At most ${MAX_TAGS} tags`;
			} else {
				value.tags = tags;
			}
		} else {
			errors.tags = 'Must be a list of tags';
		}
	} else if (!partial) {
		value.tags = [];
	}

	return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
