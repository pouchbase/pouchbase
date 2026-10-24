import type { SessionUser } from '#lib/server/services/sessions.service.js';
import type { Services } from '#lib/server/services/services.js';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// No `Platform`: SvelteKit 3 doesn't set `event.platform` on Cloudflare. The Worker's bindings
		// and `waitUntil` come from `#lib/server/platform/runtime` (`cloudflare:workers`).

		/** The error of the error page and of failed remote functions (`error()`, `fail()`). */
		interface Error {
			/** What went wrong, for people, e.g. `Could not load the API keys`. */
			message: string;
			/** The service error code, e.g. `23000`; the same code is in the server logs. */
			code?: number;
			/** What went wrong underneath (D1, the Cloudflare API, ...); only admins get it. */
			reason?: string;
			/** Reference of an unexpected error, to find it in the server logs. */
			id?: string;
		}
		interface Locals {
			services: Services;
			user: SessionUser | null;
		}
		// interface PageData {}
		interface PageState {
			/** Opens the edit collection sheet, e.g. right after creating the collection. */
			editCollection?: boolean;
		}
	}
}

export {};
