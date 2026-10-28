import { snippet } from '#lib/highlight.js';

export const send = snippet(
	'bash',
	`
curl -X POST https://pouchbase.example.com/api/mail/send \\
	-H "Authorization: Bearer $POUCHBASE_API_KEY" \\
	-H "Content-Type: application/json" \\
	-d '{
		"template": "welcome",
		"to": ["ada@example.com", "grace@example.com"],
		"variables": { "name": "Ada", "items": [{ "title": "Create a project" }] }
	}'`
);

export const sendCustom = snippet(
	'bash',
	`
curl -X POST https://pouchbase.example.com/api/mail/send \\
	-H "Authorization: Bearer $POUCHBASE_API_KEY" \\
	-H "Content-Type: application/json" \\
	-d '{
		"subject": "Your order has shipped",
		"html": "<p>Hi Ada, your order <strong>#1042</strong> is on its way.</p>",
		"to": "ada@example.com"
	}'`
);

export const sent = snippet(
	'json',
	`
{ "sent": 2 }`
);

export const invalid = snippet(
	'json',
	`
{
	"message": "Send a JSON body with \`template\`, \`to\` and optionally \`variables\`",
	"issues": { "template": "Name the template" }
}`
);

export const missing = snippet(
	'json',
	`
{
	"message": "Missing variables: name",
	"issues": { "variables.name": "Required" }
}`
);
