import { snippet } from '#lib/highlight.js';

export const request = snippet(
	'bash',
	`
curl "https://pouchbase.example.com/api/db/posts?limit=1" \\
	-H "Authorization: Bearer $TOKEN"`
);

export const error = snippet(
	'json',
	`
{
	"message": "Invalid record",
	"issues": { "title": "Required" }
}`
);

export const health = snippet(
	'bash',
	`
curl https://pouchbase.example.com/api/health
# {"status":"ok"}`
);
