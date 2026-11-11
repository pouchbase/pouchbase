import { sdkTypings } from 'virtual:pouchbase/function-typings';

/**
 * Declarations for the functions editor: the JS SDK, the instance's own types (`declarations`, from
 * `TypesService.generate`) and the `ctx` that the Worker's entry passes to the function.
 */
export function functionTypings(declarations: string) {
	return `${sdkTypings}
declare module 'pouchbase:types' {
${declarations}
}

type PouchbaseClient = import('@pouchbasejs/js-sdk').Pouchbase<
	import('pouchbase:types').Schema,
	import('pouchbase:types').MailTemplates,
	import('pouchbase:types').Functions
>;

interface ExecutionContext {
	/** Keeps the Worker running until the promise settles, after the response was sent. */
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
	/**
	 * The JS SDK acting as an admin, with the function's API key: the API rules don't apply.
	 * \`auth.me()\` is the signed-in user of the request, or \`null\`.
	 */
	pouch: PouchbaseClient;
}
`;
}
