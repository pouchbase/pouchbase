import type { FieldHandlerInfo, FieldReadItem, FieldWriteItem, FieldWriteResult } from './runtime';
import type { FieldValue } from '@pouchbasejs/plugin-sdk/server';

/**
 * Running the field hooks of a plugin (`fields.write`, `fields.read`) only when they do something:
 * `describe` reports which hooks each field type has (`fieldHandlers`), so values of types without
 * them never leave Pouchbase. Reads are split into calls of at most `MAX_READ_VALUES` values.
 */

/** Most values in one `fields.read` call. */
export const MAX_READ_VALUES = 500;

/** Whether `value` fits a column as it is: a string, a number, bytes or `null`. */
export function isFieldValue(value: unknown): value is FieldValue {
	return (
		value === null ||
		typeof value === 'string' ||
		(typeof value === 'number' && Number.isFinite(value)) ||
		value instanceof Uint8Array
	);
}

/** Whether any of `types` has one of `hooks`; without `fieldHandlers` (older plugins), always. */
export function hasHooks(
	handlers: Record<string, FieldHandlerInfo> | undefined,
	types: readonly string[],
	hooks: readonly (keyof FieldHandlerInfo)[]
): boolean {
	if (!handlers) {
		return true;
	}

	return types.some((type) => {
		const handler = Object.hasOwn(handlers, type) ? handlers[type] : undefined;

		return handler !== undefined && hooks.some((hook) => handler[hook]);
	});
}

/** `fields.write` without hooks: every value is valid and stored as it is, if a column holds it. */
export function passThroughWrite(items: readonly FieldWriteItem[]): FieldWriteResult[] {
	return items.map((item) =>
		isFieldValue(item.value)
			? { ok: true, value: item.value }
			: { ok: false, message: 'The value is not valid' }
	);
}

/**
 * Reads `items` with `read`, in calls of at most `max` values each, and puts the answers back
 * together in the order of `items`.
 */
export async function readInChunks(
	items: readonly FieldReadItem[],
	read: (items: FieldReadItem[]) => Promise<unknown[][]>,
	max = MAX_READ_VALUES
): Promise<unknown[][]> {
	const results: unknown[][] = items.map(() => []);
	let batch: { index: number; item: FieldReadItem }[] = [];
	let size = 0;

	const flush = async () => {
		if (!batch.length) {
			return;
		}

		const answers = await read(batch.map((entry) => entry.item));

		batch.forEach((entry, position) => {
			results[entry.index]!.push(...answers[position]!);
		});
		batch = [];
		size = 0;
	};

	for (const [index, item] of items.entries()) {
		for (let start = 0; start < item.values.length; start += max) {
			const values = item.values.slice(start, start + max);

			if (size + values.length > max) {
				await flush();
			}

			batch.push({ index, item: { type: item.type, values } });
			size += values.length;
		}
	}

	await flush();

	return results;
}
