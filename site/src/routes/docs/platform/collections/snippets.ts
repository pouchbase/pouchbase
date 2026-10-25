import { snippet } from '#lib/highlight.js';

// Every page uses the same two collections: `posts` (title, slug, body, status, tags, views,
// featured, author → users, cover → files, published_at, created_at, updated_at) and `comments`
// (post → posts, author → users, body, created_at).

export const record = snippet(
	'json',
	`
{
	"id": "k3j9x2m1q8w7e5r",
	"title": "Hello, Pouchbase",
	"slug": "hello-pouchbase",
	"body": "<p>Our first post.</p>",
	"status": "published",
	"tags": ["news", "release"],
	"views": 128,
	"featured": false,
	"author": "u7d2k9q4m1x8z3p",
	"cover": "f9w2e4r6t8y1u3i",
	"published_at": "2026-10-20T09:30:00.000Z",
	"created_at": 1792661400000,
	"updated_at": 1792747800000
}`
);

export const multiline = snippet(
	'bash',
	`
# Published posts, for everyone
status == "published"

# Drafts, only for their author
or (status == "draft" and author == $user.id)`
);

export const filterError = snippet(
	'json',
	`
{ "message": "Invalid where: Use \`==\` to compare" }`
);

export const ruleUpdate = snippet(
	'bash',
	`
# The author, who may leave the author out or keep it themselves
author == $user.id and ($input.author == null or $input.author == $user.id)`
);

export const ruleRecipes = snippet(
	'bash',
	`
# list and view: published posts for everyone, drafts for their author
status == "published" or author == $user.id

# create: signed in, and only with yourself as the author
$user.id != null and author == $user.id

# update: only the author, who can't hand the post to someone else
author == $user.id and ($input.author == null or $input.author == $user.id)

# delete: the author, or a user with the editor role
author == $user.id or $user.role == "editor"`
);

export const fileRecord = snippet(
	'json',
	`
{
	"id": "f9w2e4r6t8y1u3i",
	"name": "cover.jpg",
	"mime_type": "image/jpeg",
	"size": 84512,
	"thumbnails": ["400x300"],
	"created_at": 1792661100000,
	"updated_at": 1792661100000
}`
);
