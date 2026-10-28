import { snippet } from '#lib/highlight.js';

export const list = snippet(
	'bash',
	`
curl -G "https://pouchbase.example.com/api/db/posts" \\
	-H "Authorization: Bearer $TOKEN" \\
	--data-urlencode 'where=status == "published" && contains(title, "svelte")' \\
	--data-urlencode 'order=published_at:desc' \\
	--data-urlencode 'select=id,title,author' \\
	--data-urlencode 'include=author' \\
	--data-urlencode 'limit=2'`
);

export const listResponse = snippet(
	'json',
	`
{
	"items": [
		{
			"id": "k3j9x2m1q8w7e5r",
			"title": "Svelte and Pouchbase",
			"author": { "id": "u7d2k9q4m1x8z3p", "name": "Ada", "email": "ada@example.com", "avatar": null, "verified": true }
		},
		{ "id": "p2o4i6u8y0t1r3e", "title": "Svelte forms", "author": null }
	],
	"total": 17,
	"limit": 2,
	"offset": 0
}`
);

export const get = snippet(
	'bash',
	`
curl "https://pouchbase.example.com/api/db/posts/k3j9x2m1q8w7e5r?select=id,title,status" \\
	-H "Authorization: Bearer $TOKEN"`
);

export const getResponse = snippet(
	'json',
	`
{
	"id": "k3j9x2m1q8w7e5r",
	"title": "Hello, Pouchbase",
	"status": "published"
}`
);

export const create = snippet(
	'bash',
	`
curl -X POST "https://pouchbase.example.com/api/db/posts" \\
	-H "Authorization: Bearer $TOKEN" \\
	-H "Content-Type: application/json" \\
	-d '{ "title": "Hello, Pouchbase", "tags": ["news"], "author": "u7d2k9q4m1x8z3p" }'`
);

export const createResponse = snippet(
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
	"published_at": null,
	"created_at": 1792920600000,
	"updated_at": 1792920600000
}`
);

export const invalid = snippet(
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

export const conflict = snippet(
	'json',
	`
{
	"message": "A record with this value already exists",
	"issues": { "slug": "This value is already in use" }
}`
);

export const update = snippet(
	'bash',
	`
curl -X PATCH "https://pouchbase.example.com/api/db/posts/k3j9x2m1q8w7e5r?select=id,status,updated_at" \\
	-H "Authorization: Bearer $TOKEN" \\
	-H "Content-Type: application/json" \\
	-d '{ "status": "published" }'`
);

export const updateResponse = snippet(
	'json',
	`
{
	"id": "k3j9x2m1q8w7e5r",
	"status": "published",
	"updated_at": 1792924200000
}`
);

export const remove = snippet(
	'bash',
	`
curl -X DELETE "https://pouchbase.example.com/api/db/posts/k3j9x2m1q8w7e5r" \\
	-H "Authorization: Bearer $TOKEN"
# 204 No Content`
);

export const restricted = snippet(
	'json',
	`
{ "message": "Records of comments still link to this record through post" }`
);

export const locked = snippet(
	'json',
	`
{ "message": "Only admins can do this: the API rule is locked" }`
);

export const invalidQuery = snippet(
	'json',
	`
{ "message": "Invalid where: Use \`==\` to compare" }`
);
