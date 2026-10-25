import { snippet } from '#lib/highlight.js';

// The examples use the `posts` and `comments` collections of the platform docs (see Collections).

export const find = snippet(
	'typescript',
	`
const post = await pouch.db.posts.find('k3j9x2m1q8w7e5r'); // PostsRecord | null

// Only some fields; the result type has only them too
const summary = await pouch.db.posts.find(id, { select: ['id', 'title', 'status'] });

// Throws a not_found error instead of returning null
const sure = await pouch.db.posts.findOrThrow(id);`
);

export const findResponse = snippet(
	'json',
	`
{
	"id": "k3j9x2m1q8w7e5r",
	"title": "Hello, Pouchbase",
	"status": "published"
}`
);

export const findMany = snippet(
	'typescript',
	`
const page = await pouch.db.posts.findMany({
	where: { status: 'published', views: { gte: 10 } },
	orderBy: { published_at: 'desc' },
	select: ['id', 'title', 'views'],
	limit: 2
});`
);

export const findManyResponse = snippet(
	'json',
	`
{
	"items": [
		{ "id": "k3j9x2m1q8w7e5r", "title": "Hello, Pouchbase", "views": 128 },
		{ "id": "p2o4i6u8y0t1r3e", "title": "Filtering records", "views": 42 }
	],
	"total": 17,
	"limit": 2,
	"offset": 0,
	"hasMore": true
}`
);

export const pagination = snippet(
	'typescript',
	`
// Page 3 of 20 per page
const { items, total } = await pouch.db.posts.findMany({ limit: 20, offset: 40 });
const pages = Math.ceil(total / 20);

// Every match, fetched 200 at a time as you go
for await (const post of pouch.db.posts.iterate({ where: { status: 'draft' } })) {
	console.log(post.title);
}

// Every match in one array, for small collections
const all = await pouch.db.posts.findAll({ orderBy: { title: 'asc' } });

const first = await pouch.db.posts.findFirst({ where: { featured: true } }); // or null
const count = await pouch.db.posts.count({ status: 'published' }); // 17`
);

export const relations = snippet(
	'typescript',
	`
const post = await pouch.db.posts.find(id, {
	select: ['id', 'title', 'author', 'cover'],
	include: { author: true, cover: true }
});

post?.author; // UsersRecord | null
post?.cover; // FilesRecord | null`
);

export const relationsResponse = snippet(
	'json',
	`
{
	"id": "k3j9x2m1q8w7e5r",
	"title": "Hello, Pouchbase",
	"author": {
		"id": "u7d2k9q4m1x8z3p",
		"name": "Ada",
		"email": "ada@example.com",
		"avatar": null,
		"verified": true
	},
	"cover": {
		"id": "f9w2e4r6t8y1u3i",
		"name": "cover.jpg",
		"mime_type": "image/jpeg",
		"size": 84512,
		"thumbnails": ["400x300"],
		"created_at": 1792661100000,
		"updated_at": 1792661100000
	}
}`
);

export const nestedRelations = snippet(
	'typescript',
	`
// The comments of a post, each with its author
const { items } = await pouch.db.comments.findMany({
	where: { post: postId },
	orderBy: { created_at: 'asc' },
	include: { author: true, post: { include: { author: true } } }
});

items[0].author?.name; // string
items[0].post?.author?.name; // the author of the post, two levels deep`
);

export const insert = snippet(
	'typescript',
	`
const post = await pouch.db.posts.insert({
	title: 'Hello, Pouchbase',
	status: 'draft',
	tags: ['news'],
	author: user.id,
	published_at: new Date() // dates may be Date objects
});`
);

export const insertResponse = snippet(
	'json',
	`
{
	"id": "k3j9x2m1q8w7e5r",
	"title": "Hello, Pouchbase",
	"slug": "hello-pouchbase",
	"body": null,
	"status": "draft",
	"tags": ["news"],
	"views": 0,
	"featured": false,
	"author": "u7d2k9q4m1x8z3p",
	"cover": null,
	"published_at": "2026-10-25T09:30:00.000Z",
	"created_at": 1792920600000,
	"updated_at": 1792920600000
}`
);

export const patch = snippet(
	'typescript',
	`
// Only the fields you send change; the result is the whole record
const post = await pouch.db.posts.patch(id, { status: 'published', views: 1 });

// Only some fields back, with the author as a record
const saved = await pouch.db.posts.patch(
	id,
	{ title: 'Hello again' },
	{ select: ['id', 'title', 'author'], include: { author: true } }
);

await pouch.db.posts.remove(id); // resolves with nothing`
);

export const errors = snippet(
	'typescript',
	`
import { isPouchbaseError } from '@pouchbasejs/js-sdk';

try {
	await pouch.db.posts.insert({ title: '' });
} catch (error) {
	if (isPouchbaseError(error, 'invalid')) {
		error.issues.title; // 'Required'
	}
}

// Or without try/catch, e.g. in a form:
const result = await pouch.db.posts.insert(values).safe();

if (!result.ok) {
	result.error.kind; // 'invalid', 'forbidden', 'conflict', …
	result.error.issues; // { title?: string; slug?: string; … }, typed by the fields of posts
} else {
	result.data.id;
}`
);

export const invalidResponse = snippet(
	'json',
	`
{
	"message": "Invalid record",
	"issues": {
		"title": "Required",
		"status": "Choose an item from the list"
	}
}`
);

export const conflictResponse = snippet(
	'json',
	`
{
	"message": "A record with this value already exists",
	"issues": { "slug": "This value is already in use" }
}`
);
