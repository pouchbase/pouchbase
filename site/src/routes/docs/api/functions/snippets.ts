import { snippet } from '#lib/highlight.js';

export const call = snippet(
	'bash',
	`
curl -X POST https://pouchbase.example.com/api/functions/hello \\
	-H "Authorization: Bearer $TOKEN" \\
	-H "Content-Type: application/json" \\
	-d '{ "name": "Ada" }'`
);

export const callResponse = snippet(
	'json',
	`
{ "message": "Hello Ada!" }`
);

export const path = snippet(
	'bash',
	`
# The function orders gets GET /42?include=items
curl "https://pouchbase.example.com/api/functions/orders/42?include=items" \\
	-H "Authorization: Bearer $TOKEN"`
);

export const signIn = snippet(
	'json',
	`
{ "message": "Sign in to call this function" }`
);
