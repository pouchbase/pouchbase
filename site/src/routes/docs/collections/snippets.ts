import { snippet } from '#lib/highlight.js';

export const types = snippet(
	'bash',
	`
npx @pouchbasejs/js-sdk types "https://pouchbase.example.com/api/types?token=…" --out src/pouchbase.ts`
);

export const read = snippet(
	'typescript',
	`
const { items, total, hasMore } = await pouch.db.posts.findMany({
	where: {
		status: 'published', // equals
		views: { gte: 10 }, // eq, not, in, notIn, gt, gte, lt, lte
		title: { contains: 'svelte' }, // contains, notContains
		tags: { has: 'news' }, // arrays: has, isEmpty
		$or: [{ author: user.id }, { featured: true }]
	},
	orderBy: { created_at: 'desc' },
	select: ['id', 'title'], // items: { id: string; title: string }[]
	limit: 20, // 1 to 500, default 30
	offset: 40 // skip the first 40
});
// total: every match; hasMore: total > offset + items.length

const post = await pouch.db.posts.find(id); // PostsRecord | null
const draft = await pouch.db.posts.findFirst({ where: { status: 'draft' } }); // or null
const count = await pouch.db.posts.count({ status: 'published' });

// Every record, fetched in pages as you go
for await (const post of pouch.db.posts.iterate({ orderBy: { title: 'asc' } })) {
	console.log(post.title);
}`
);

export const relations = snippet(
	'typescript',
	`
const post = await pouch.db.posts.find(id, {
	include: { author: true, comments: { include: { author: true } } }
});

post?.author; // UsersRecord | null
post?.comments; // (CommentsRecord & { author: UsersRecord | null })[]`
);

export const write = snippet(
	'typescript',
	`
const created = await pouch.db.posts.insert({ title: 'Hello', published: true, tags: ['news'] });
await pouch.db.posts.patch(created.id, { title: 'Hello again' }); // only these fields
await pouch.db.posts.remove(created.id);

// Without try/catch, e.g. in a form:
const result = await pouch.db.posts.insert(values).safe();

if (!result.ok) {
	result.error.kind; // 'invalid', 'forbidden', 'conflict', …
	result.error.issues; // { title?: string; … }, typed by the fields of posts
}`
);

export const handWritten = snippet(
	'typescript',
	`
import { condition } from '@pouchbasejs/js-sdk';

// Values in \${…} are escaped.
await pouch.db.posts.findMany({
	where: condition\`author == $user.id or title contains \${search}\`
});`
);

export const files = snippet(
	'typescript',
	`
pouch.files.url(fileId); // https://pouchbase.example.com/api/files/<id>
pouch.files.url(fileId, { size: '100x100:fit' }); // a thumbnail size from the files settings
pouch.files.url(fileId, { download: true });`
);

export const schema = snippet(
	'typescript',
	`
// An API key with the service scope, never in code that runs in a browser.
const pouch = createClient(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_SERVICE_KEY });

await pouch.schema.create({
	name: 'posts',
	fields: [
		{ name: 'id', type: 'id', options: { generator: 'random' } },
		{ name: 'title', type: 'text', required: true }
	],
	rules: { list: '', view: '' } // everyone may list and view
});

// Copy the schema to another instance: matched by id, then by name.
const file = await pouch.schema.export({ collections: ['posts'] });
const { plan } = await other.schema.import(file, { dryRun: true });
await other.schema.import(file, { force: true }); // force: also changes that remove data`
);
