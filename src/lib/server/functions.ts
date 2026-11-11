import { POUCHBASE_INSTANCE } from '$app/env/private';

import { entry } from 'virtual:pouchbase/function-worker';

/**
 * The Worker of a function has two modules: the function's own code and the entry around it
 * (`function-worker/pouchbase.ts`), which checks the secret and gives the function the JS SDK.
 */

/** Module with the function's own code. */
export const FUNCTION_MODULE = 'function.js';

/** Main module of the Worker: the code below, which imports `FUNCTION_MODULE`. */
export const ENTRY_MODULE = 'pouchbase.js';

export const ENTRY_CODE = entry;

/** The Worker of a function, prefixed with the instance so instances on one account don't clash. */
export function scriptName(functionName: string) {
	return `${POUCHBASE_INSTANCE}-fn-${functionName}`;
}
