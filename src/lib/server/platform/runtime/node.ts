/**
 * No Worker, so no bindings: Docker and the binary reach D1 through the D1 gateway (see
 * `../cloudflare/gateway`), `vite dev` over the REST API.
 */
export function workerEnv(): Record<string, unknown> | null {
	return null;
}

/** Lets `promise` finish after the response; a Node process keeps running anyway. */
export function background(promise: Promise<unknown>) {
	promise.catch((error: unknown) => {
		console.error('[pouchbase] background work failed', error);
	});
}
