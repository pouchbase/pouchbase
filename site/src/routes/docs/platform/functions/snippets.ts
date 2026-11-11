import { snippet } from '#lib/highlight.js';

export const handler = snippet(
	'typescript',
	`
/** Variables and secrets of this function (Secrets tab). */
interface Env {
	/** URL of this Pouchbase installation. */
	POUCHBASE_URL: string;
	/** API key of this function; ctx.pouch uses it. */
	POUCHBASE_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// ctx.pouch is the JS SDK acting as an admin, past the API rules. auth.me() is the signed-in
		// user (null without a token), so check what the caller may do.
		const user = await ctx.pouch.auth.me();
		const { searchParams } = new URL(request.url);
		const name = searchParams.get('name') ?? user?.email ?? 'world';

		return Response.json({ message: \`Hello \${name}!\` });
	}
};`
);

export const sdk = snippet(
	'typescript',
	`
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const user = await ctx.pouch.auth.me();

		if (!user) {
			return Response.json({ message: 'Sign in first' }, { status: 401 });
		}

		// Past the API rules, so the function limits this to the caller's own posts
		const { items } = await ctx.pouch.db.posts.findMany({ where: { author: user.id } });

		await ctx.pouch.db.stats.insert({ user: user.id, posts: items.length });

		return Response.json(items);
	}
};`
);

export const bundle = snippet(
	'bash',
	`
npx esbuild src/my-function.ts --bundle --format=esm --outfile=dist/my-function.js`
);
