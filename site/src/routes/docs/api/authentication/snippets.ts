import { snippet } from '#lib/highlight.js';

export const register = snippet(
	'bash',
	`
curl -X POST https://pouchbase.example.com/api/auth/password/register \\
	-H "Content-Type: application/json" \\
	-d '{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "correct horse battery staple" }'`
);

export const registerResponse = snippet(
	'json',
	`
{
	"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
	"user_id": "u7d2k9q4m1x8z3p",
	"verification_required": false
}`
);

export const registerInvalid = snippet(
	'json',
	`
{
	"message": "Invalid input",
	"issues": { "password": "Password must be at least 8 characters" }
}`
);

export const login = snippet(
	'bash',
	`
curl -X POST https://pouchbase.example.com/api/auth/password/login \\
	-H "Content-Type: application/json" \\
	-d '{ "email": "ada@example.com", "password": "correct horse battery staple" }'`
);

export const loginResponse = snippet(
	'json',
	`
{
	"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
	"user_id": "u7d2k9q4m1x8z3p"
}`
);

export const notVerified = snippet(
	'json',
	`
{ "message": "Verify your email address first", "code": "email_not_verified" }`
);

export const me = snippet(
	'bash',
	`
curl https://pouchbase.example.com/api/auth/me \\
	-H "Authorization: Bearer $TOKEN"`
);

export const meResponse = snippet(
	'json',
	`
{
	"id": "u7d2k9q4m1x8z3p",
	"email": "ada@example.com",
	"name": "Ada Lovelace",
	"avatar": null,
	"verified": true,
	"created_at": 1792661400000,
	"updated_at": 1792661400000
}`
);

export const emails = snippet(
	'bash',
	`
# Send the verification link again, or a link to choose a new password
curl -X POST https://pouchbase.example.com/api/auth/email/send-verification \\
	-H "Content-Type: application/json" -d '{ "email": "ada@example.com" }'
curl -X POST https://pouchbase.example.com/api/auth/password/forgot \\
	-H "Content-Type: application/json" -d '{ "email": "ada@example.com" }'

# With the token from the link, when your own app handles the links
curl -X POST https://pouchbase.example.com/api/auth/email/verify \\
	-H "Content-Type: application/json" -d '{ "token": "…" }'
curl -X POST https://pouchbase.example.com/api/auth/password/reset \\
	-H "Content-Type: application/json" -d '{ "token": "…", "password": "a new password" }'`
);

export const providers = snippet(
	'json',
	`
[
	{ "provider": "github", "label": "GitHub", "iconUrl": "https://…/github.svg?v=1.0.0" },
	{ "provider": "google", "label": "Google", "iconUrl": "https://…/google.svg?v=1.0.0" }
]`
);

export const oauth = snippet(
	'javascript',
	`
// 1. A random state and verifier, and the S256 challenge of the verifier (RFC 7636)
const base64url = (bytes) =>
	btoa(String.fromCharCode(...bytes)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

const state = random();
const verifier = random();
const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
const challenge = base64url(new Uint8Array(digest));

// 2. Open the sign-in in a popup, from a click handler
window.open(\`https://pouchbase.example.com/api/auth/oauth2/github?state=\${state}&challenge=\${challenge}\`);

// 3. Poll for the result with the verifier, which only you know
async function result() {
	const response = await fetch('https://pouchbase.example.com/api/auth/oauth2/result', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ state, verifier })
	});

	if (response.status === 202) {
		await new Promise((done) => setTimeout(done, 1000));
		return result(); // still signing in
	}

	return response.json(); // { status: 'done', token, user_id } or { status: 'error', error }
}`
);

export const oauthResult = snippet(
	'json',
	`
{
	"status": "done",
	"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
	"user_id": "u7d2k9q4m1x8z3p"
}`
);
