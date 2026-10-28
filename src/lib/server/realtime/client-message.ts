import type { ClientMessage } from '../../realtime/protocol.ts';

/**
 * Parses the messages clients send to a realtime hub. Only relative imports: the Worker bundles
 * this file outside of Vite (`scripts/worker-entry.mjs`).
 */

const ID_PATTERN = /^[\w-]{1,64}$/;
const MAX_FIELDS = 100;
/** Paths in `expand`, each at most three field names. */
const MAX_INCLUDE = 20;
const MAX_TEXT = 4096;

function isObject(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value: unknown, max: number) {
	return value === undefined || (typeof value === 'string' && value.length <= max);
}

/** A client message, or why it isn't one. */
export function parseClientMessage(text: string): ClientMessage | { error: string } {
	let message: unknown;

	try {
		message = JSON.parse(text);
	} catch {
		return { error: 'Messages must be JSON' };
	}

	if (!isObject(message) || typeof message.type !== 'string') {
		return { error: 'A message is an object with a `type`' };
	}

	switch (message.type) {
		case 'auth':
			return optionalText(message.token, MAX_TEXT)
				? { type: 'auth', token: (message.token as string | undefined) || undefined }
				: { error: '`token` must be a string' };
		case 'subscribe': {
			const { id, record, where, select, include } = message;

			if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
				return { error: '`id` must be 1 to 64 letters, digits, `_` or `-`' };
			}

			if (!optionalText(record, 256) || record === '') {
				return { error: '`record` must be a record id' };
			}

			if (!optionalText(where, MAX_TEXT)) {
				return { error: '`where` must be a string' };
			}

			if (
				select !== undefined &&
				(!Array.isArray(select) ||
					select.length > MAX_FIELDS ||
					select.some((name) => typeof name !== 'string' || name.length > 64))
			) {
				return { error: '`select` must be a list of field names' };
			}

			if (
				include !== undefined &&
				(!Array.isArray(include) ||
					include.length > MAX_INCLUDE ||
					include.some((path) => typeof path !== 'string' || path.length > 200))
			) {
				return { error: '`include` must be a list of relation fields, such as `author.team`' };
			}

			return {
				type: 'subscribe',
				id,
				record: record as string | undefined,
				where: (where as string | undefined)?.trim() || undefined,
				select: (select as string[] | undefined)?.length ? (select as string[]) : undefined,
				include: (include as string[] | undefined)?.length ? (include as string[]) : undefined
			};
		}
		case 'unsubscribe':
			return typeof message.id === 'string' && ID_PATTERN.test(message.id)
				? { type: 'unsubscribe', id: message.id }
				: { error: '`id` must be the id of a subscription' };
		default:
			return { error: `Unknown message type \`${message.type}\`` };
	}
}
