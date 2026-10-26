// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		/** The error of the error page and of failed remote functions. */
		interface Error {
			/** What went wrong underneath, if it helps people, e.g. that a service is unreachable. */
			reason?: string;
			/** Reference of an unexpected error, to find it in the logs. */
			id?: string;
		}
		interface Locals {
			/** The signed-in user, once `currentUser()` loaded it; `null` when signed out. */
			user?: import('#lib/server/pouchbase.js').UsersRecord | null;
		}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
