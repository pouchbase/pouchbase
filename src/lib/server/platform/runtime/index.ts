/**
 * What the runtime offers outside a request: the Worker's bindings and work that continues after
 * the response. SvelteKit 3 has no `event.platform` on Cloudflare any more; a Worker gets its
 * bindings from `cloudflare:workers` instead. This module re-exports the Node version, which
 * `vite dev` and the Node target use (no bindings, nothing to wait for); the Worker build resolves
 * the import below to `./workers` (`vite/platform.ts`).
 */
import type { ResultAsync } from 'neverthrow';

import { background } from './node';

export { background, workerEnv } from './node';

/**
 * Lets a publish finish after the response and logs a failure: saving a record never waits for,
 * or fails because of, its realtime event.
 */
export function inBackground(result: ResultAsync<void, unknown>) {
	background(
		Promise.resolve(
			result.mapErr((failure) => {
				console.error('[realtime] publish failed', failure);
			})
		)
	);
}
