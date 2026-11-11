import { decodeToken, Pouchbase } from '@pouchbasejs/js-sdk';

import { SECRET_HEADER } from '../../functions/functions';
import handler from './function.js';

/**
 * `pouchbase.js`, the entry of a function's Worker: the code around the function. Functions are
 * reached through `/api/functions/<name>`, which checks the caller and forwards the request to the
 * Worker's workers.dev URL with the function's secret in `SECRET_HEADER`. The entry only answers
 * requests with that secret, removes it before the function sees the request, and leaves the secret
 * out of `env`. Bundled by `vite/function-worker.ts`, with the JS SDK inside.
 *
 * The function gets `ctx.pouch`, the JS SDK with the function's API key, so the API rules don't
 * apply. Its session holds the bearer token of the request, so `ctx.pouch.auth.me()` is the
 * signed-in user. The client is made per request, so a caller's token never reaches another request.
 */

/** The Worker's bindings; the function's secrets are in here too. */
type Env = {
	POUCHBASE_FUNCTION_SECRET?: string;
	POUCHBASE_URL: string;
	POUCHBASE_API_KEY: string;
};

const encoder = new TextEncoder();

function matches(value: string | null, secret: string | undefined) {
	const left = encoder.encode(value ?? '');
	const right = encoder.encode(secret ?? '');

	return (
		left.byteLength > 0 &&
		left.byteLength === right.byteLength &&
		(
			crypto.subtle as unknown as { timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean }
		).timingSafeEqual(left, right)
	);
}

/** The function's client, signed in as the caller of `request` when it has a bearer token. */
function createPouch(request: Request, env: Env) {
	const pouch = new Pouchbase(env.POUCHBASE_URL, { apiKey: env.POUCHBASE_API_KEY });
	const [scheme, token] = (request.headers.get('authorization') ?? '').split(' ');
	const userId = token ? decodeToken(token)?.sub : null;

	if (scheme?.toLowerCase() === 'bearer' && token && typeof userId === 'string') {
		pouch.session.begin({ token, userId });
	}

	return pouch;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		if (!matches(request.headers.get(SECRET_HEADER), env.POUCHBASE_FUNCTION_SECRET)) {
			return new Response('Not found', { status: 404 });
		}

		if (typeof handler?.fetch !== 'function') {
			return new Response(
				'The function does not export a fetch handler: export default { fetch(request, env, ctx) { ... } }',
				{ status: 500 }
			);
		}

		const headers = new Headers(request.headers);
		headers.delete(SECRET_HEADER);

		const functionEnv: Partial<Env> = { ...env };
		delete functionEnv.POUCHBASE_FUNCTION_SECRET;

		return handler.fetch(new Request(request, { headers }), functionEnv, {
			waitUntil: (promise: Promise<unknown>) => ctx.waitUntil(promise),
			passThroughOnException: () => ctx.passThroughOnException(),
			pouch: createPouch(request, env)
		});
	}
};
