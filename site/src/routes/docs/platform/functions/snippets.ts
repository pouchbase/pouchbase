import { snippet } from '#lib/highlight.js';

export const handler = snippet(
	'typescript',
	`
/** Variables and secrets of this function (Secrets tab). */
interface Env {
	/** URL of this Pouchbase installation. */
	POUCHBASE_URL: string;
	STRIPE_KEY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// The signed-in app user, when the request has a valid token; otherwise null.
		const user = pouchbaseUser(request);
		const { searchParams } = new URL(request.url);
		const name = searchParams.get('name') ?? user?.email ?? 'world';

		return Response.json({ message: \`Hello \${name}!\` });
	}
};`
);

export const bundle = snippet(
	'bash',
	`
npx esbuild src/my-function.ts --bundle --format=esm --outfile=dist/my-function.js`
);
