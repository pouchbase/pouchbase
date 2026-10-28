import type { FieldOptions } from './types';

/** Most items a list field can have. */
export const MAX_LIST_VALUES = 200;

/** Longest item of a list field, in characters. */
export const MAX_LIST_VALUE_LENGTH = 100;

/**
 * The items of a list field from a form: a JSON array of strings. Items are trimmed; blanks and
 * repeats are dropped.
 */
export function parseListValues(json: string | undefined): string[] {
	let parsed: unknown;

	try {
		parsed = JSON.parse(json || '[]');
	} catch {
		return [];
	}

	return Array.isArray(parsed)
		? [...new Set(parsed.map((item) => String(item).trim()))].filter(Boolean)
		: [];
}

/** The items of a list field's options, trimmed, without blanks and repeats. */
export function cleanListValues(values: readonly unknown[] | undefined): string[] {
	return [...new Set((values ?? []).map((value) => String(value).trim()))].filter(Boolean);
}

/**
 * Why the items of a list field aren't valid, or `null`: a list needs at least one item, at most
 * `MAX_LIST_VALUES`, each at most `MAX_LIST_VALUE_LENGTH` characters.
 */
export function listValuesIssue(values: string[]): string | null {
	const tooLong = values.find((value) => value.length > MAX_LIST_VALUE_LENGTH);

	if (!values.length) {
		return 'Add at least one item';
	}

	if (values.length > MAX_LIST_VALUES) {
		return `A list can have at most ${MAX_LIST_VALUES} items`;
	}

	if (tooLong) {
		return `Items can be at most ${MAX_LIST_VALUE_LENGTH} characters: ${tooLong.slice(0, 20)}…`;
	}

	return null;
}

/** Options of a list field, cleaned up; `null` when it has no valid items. */
export function listOptions(options: FieldOptions): FieldOptions | null {
	const values = cleanListValues(options.values);

	return listValuesIssue(values) ? null : { values, multiple: options.multiple ?? false };
}

/**
 * The selected items of a stored list value: a JSON array for lists that allow multiple items,
 * otherwise a single item.
 */
export function listSelection(value: unknown, multiple: boolean | undefined): string[] {
	if (typeof value !== 'string' || value === '') {
		return [];
	}

	if (!multiple) {
		return [value];
	}

	try {
		const parsed: unknown = JSON.parse(value);

		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}
