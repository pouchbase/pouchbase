/**
 * Serverless functions, shared by the Functions pages and the server: naming rules, the starter
 * code and what the code can use. Every function runs as a Worker of its own on Cloudflare and is
 * called through `/api/functions/<name>`.
 */

export const FUNCTION_LANGUAGES = ['typescript', 'javascript'] as const;

export type FunctionLanguage = (typeof FUNCTION_LANGUAGES)[number];

/** Lowercase letters, digits and dashes, not at the ends: part of a URL and a Worker's name. */
export const FUNCTION_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * The Worker's name is `<instance>-fn-<name>` (an instance name has at most 19 characters), and a
 * workers.dev label has at most 63 characters.
 */
export const FUNCTION_NAME_MAX_LENGTH = 40;

/** Upper-case letters, digits and underscores, starting with a letter or underscore. */
export const SECRET_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

/** Variables Pouchbase sets itself; secrets can't use these names. */
export const RESERVED_ENV_NAMES = [
	'POUCHBASE_URL',
	'POUCHBASE_FUNCTION_SECRET',
	'POUCHBASE_API_KEY'
];

/** Most code a version may have (source and compiled JavaScript together), in bytes. */
export const MAX_CODE_SIZE = 1024 * 1024;

/** Request header with the function's secret, from Pouchbase to the Worker. */
export const SECRET_HEADER = 'x-pouchbase-function-secret';

/** Methods the test panel can send. */
export const TEST_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** The language of an uploaded file, from its name; `null` when it isn't JavaScript or TypeScript. */
export function languageOf(fileName: string): FunctionLanguage | null {
	if (/\.(?:ts|mts)$/i.test(fileName)) {
		return 'typescript';
	}

	return /\.(?:js|mjs)$/i.test(fileName) ? 'javascript' : null;
}

const TYPESCRIPT_TEMPLATE = `/** Variables and secrets of this function (Secrets tab). */
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
};
`;

const JAVASCRIPT_TEMPLATE = `export default {
	/**
	 * @param {Request} request
	 * @param {{ POUCHBASE_URL: string, POUCHBASE_API_KEY: string }} env Variables and secrets of this
	 *   function (Secrets tab); ctx.pouch uses the API key.
	 * @param {ExecutionContext} ctx
	 */
	async fetch(request, env, ctx) {
		// ctx.pouch is the JS SDK acting as an admin, past the API rules. auth.me() is the signed-in
		// user (null without a token), so check what the caller may do.
		const user = await ctx.pouch.auth.me();
		const { searchParams } = new URL(request.url);
		const name = searchParams.get('name') ?? user?.email ?? 'world';

		return Response.json({ message: \`Hello \${name}!\` });
	}
};
`;

/** Libraries of the editor: the Workers runtime has `fetch`, `Request` and friends, not the DOM. */
export const FUNCTION_LIBS = ['es2022', 'webworker'];

/** The code a new function starts with. */
export function functionTemplate(language: FunctionLanguage) {
	return language === 'typescript' ? TYPESCRIPT_TEMPLATE : JAVASCRIPT_TEMPLATE;
}
