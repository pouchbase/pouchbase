import { snippet } from '#lib/highlight.js';

export const create = snippet(
	'bash',
	`
curl -X POST https://pouchbase.example.com/api/schema \\
	-H "Authorization: Bearer $POUCHBASE_SERVICE_KEY" \\
	-H "Content-Type: application/json" \\
	-d '{
		"name": "posts",
		"fields": [
			{ "name": "id", "type": "id", "options": { "generator": "random" } },
			{ "name": "title", "type": "text", "required": true },
			{ "name": "created_at", "type": "created" }
		],
		"indexes": [{ "columns": ["title"], "unique": false }],
		"rules": { "list": "", "view": "", "create": "$user.id != null" }
	}'`
);

export const collection = snippet(
	'json',
	`
{
	"id": "c4f8a2b6d1e9h3j",
	"name": "posts",
	"system": false,
	"settings": {
		"rules": { "list": "", "view": "", "create": "$user.id != null" }
	},
	"fields": [
		{
			"id": "f8h7g6e5d4c3b2a",
			"name": "title",
			"type": "text",
			"required": true,
			"unique": false,
			"hidden": false,
			"defaultValue": null,
			"options": {},
			"system": false,
			"position": 1
		},
		…
	],
	"indexes": [{ "name": "…", "columns": ["title"], "unique": false }]
}`
);

export const update = snippet(
	'bash',
	`
# Only the rules change; the actions left out keep their rule
curl -X PATCH https://pouchbase.example.com/api/schema/posts \\
	-H "Authorization: Bearer $POUCHBASE_SERVICE_KEY" \\
	-H "Content-Type: application/json" \\
	-d '{ "rules": { "update": "author == $user.id" } }'`
);

export const destructive = snippet(
	'json',
	`
{
	"message": "The changes delete collections, fields or their data; send \`force=true\` to make them",
	"plan": {
		"steps": [
			{
				"kind": "field.delete",
				"severity": "destructive",
				"collectionId": "c4f8a2b6d1e9h3j",
				"collection": "posts",
				"fieldId": "f5e4d3c2b1a9z8y",
				"field": "body",
				"description": "Delete field posts.body and its data"
			}
		],
		"warnings": []
	}
}`
);

export const transfer = snippet(
	'bash',
	`
# Export some collections from one instance…
curl "https://dev.example.com/api/schema/export?collections=posts,comments" \\
	-H "Authorization: Bearer $DEV_SERVICE_KEY" > schema.json

# …see what importing them into another would change…
curl -X POST "https://pouchbase.example.com/api/schema/import?dryRun=true" \\
	-H "Authorization: Bearer $POUCHBASE_SERVICE_KEY" \\
	-H "Content-Type: application/json" \\
	--data @schema.json

# …and import them
curl -X POST "https://pouchbase.example.com/api/schema/import?force=true" \\
	-H "Authorization: Bearer $POUCHBASE_SERVICE_KEY" \\
	-H "Content-Type: application/json" \\
	--data @schema.json`
);

export const importResponse = snippet(
	'json',
	`
{
	"applied": false,
	"plan": {
		"steps": [
			{
				"kind": "collection.create",
				"severity": "safe",
				"collectionId": "d7k2m9q4x1z8p3w",
				"collection": "comments",
				"description": "Create collection comments"
			}
		],
		"warnings": []
	}
}`
);

export const types = snippet(
	'bash',
	`
curl "https://pouchbase.example.com/api/types?token=…" > src/pouchbase.ts`
);
