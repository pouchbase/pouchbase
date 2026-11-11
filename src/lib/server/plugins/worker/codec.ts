/**
 * What Pouchbase and the Worker of an installed plugin agree on: the paths and headers of the
 * requests between them, and how a call travels as JSON. Imported by both sides, so it can't
 * drift; see `worker.ts` for the host side and `pouchbase.ts` for the Worker's entry.
 */

/** Request header with the plugin's secret, from Pouchbase to the Worker. */
export const SECRET_HEADER = 'x-pouchbase-plugin-secret';

/** Path of the calls (`PluginCall`). */
export const CALL_PATH = '/__call';

/** Prefix of the route requests: `/__route/items/42` runs the route of `/items/42`. */
export const ROUTE_PATH = '/__route';

/** Prefix of the function requests: `/__function/get-posts` runs the function `get-posts`. */
export const FUNCTION_PATH = '/__function';

/** Request header of a route or function request with its context as JSON; see `routeContextHeader`. */
export const CONTEXT_HEADER = 'x-pouchbase-plugin-context';

/** Response header that marks a route handler that failed, instead of a response of its own. */
export const ERROR_HEADER = 'x-pouchbase-plugin-error';

/** Key of the object that stands for a `Uint8Array` in the JSON of a call. */
export const BYTES_KEY = '__pouchbase_bytes__';

function toBase64(bytes: Uint8Array) {
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

/** `JSON.stringify` with bytes as `{ [BYTES_KEY]: <base64> }`. */
export function encodeCallJson(value: unknown) {
	return JSON.stringify(value, (_key, item: unknown) =>
		item instanceof Uint8Array ? { [BYTES_KEY]: toBase64(item) } : item
	);
}

/** `JSON.parse` that turns `{ [BYTES_KEY]: <base64> }` back into bytes. */
export function decodeCallJson(text: string): unknown {
	return JSON.parse(text, (_key, item: unknown) => {
		if (
			typeof item === 'object' &&
			item !== null &&
			Object.keys(item).length === 1 &&
			typeof (item as Record<string, unknown>)[BYTES_KEY] === 'string'
		) {
			return Uint8Array.from(atob((item as Record<string, string>)[BYTES_KEY]!), (char) =>
				char.charCodeAt(0)
			);
		}

		return item;
	});
}
