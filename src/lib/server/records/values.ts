import type { Collection } from '../services/collections.service';
import type { Field } from '../services/fields.service';

import { idGenerator, isMultiple, isRelationType } from '#lib/fields/field-types.js';

/**
 * Pure helpers for record values: how a submitted value becomes a stored one, how a stored one
 * becomes what the records API returns, and the columns every record operation reads.
 */

/**
 * A value as the grid and the record form get it. Fields with a plugin's type hold what the
 * plugin's `deserialize` returned, which can be any value that devalue can send.
 */
export type RecordValue = string | number | null | RelationRef[];

/** A related record as shown in the grid: its id and a human readable label. */
export type RelationRef = { id: string; label: string };

/**
 * A record with a value per field. `_key` identifies it: the value of the ID field, or its `rowid`
 * when the collection has none. Field names start with a letter, so it never collides with one.
 */
export type RecordRow = { _key: string } & {
	[column: string]: RecordValue;
};

/**
 * A record as the records API returns it: every field except blobs, with real values: booleans as
 * `true`/`false`, JSON fields parsed, and multiple relations, files and lists as arrays.
 */
export type ApiRecord = Record<string, unknown>;

/** Field values as submitted by a form, keyed by field name. */
export type RecordInput = Record<string, unknown>;

/** Validation messages keyed by field name. */
export type RecordIssues = Record<string, string>;

/** The collection, its fields and the app database id: what every record operation needs. */
export type RecordContext = { collection: Collection; fields: Field[]; databaseId: string };

/** A value as it is bound to a statement. */
export type StoredValue = string | number | null;

/** D1 allows at most 100 bound parameters per statement (SQLite itself allows more). */
export const MAX_IDS = 90;

export function isEmpty(value: unknown) {
	return value === undefined || value === null || value === '';
}

/** The ids in a relation value: an array, a JSON array, one id, or none. Throws on bad JSON. */
export function parseIds(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map(String).filter(Boolean);
	}

	if (typeof value !== 'string' || value === '') {
		return [];
	}

	if (value.startsWith('[')) {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
	}

	return [value];
}

/**
 * Converts a submitted value into what is stored in the column.
 *
 * @returns `{ value }` (`null` for an empty value) or `{ error }` with a message for the form.
 */
export function parseValue(field: Field, raw: unknown): { value: StoredValue } | { error: string } {
	if (field.type === 'boolean') {
		const checked = raw === true || raw === 'true' || raw === 'on' || raw === '1' || raw === 1;
		return { value: checked ? 1 : 0 };
	}

	if (isRelationType(field.type)) {
		let ids: string[];

		try {
			ids = parseIds(raw);
		} catch {
			return { error: 'Invalid selection' };
		}

		if (!ids.length) {
			return field.required ? { error: 'Required' } : { value: null };
		}

		return { value: field.options.multiple ? JSON.stringify(ids) : ids[0] };
	}

	if (field.type === 'list') {
		let selected: string[];

		try {
			selected = field.options.multiple
				? [...new Set(parseIds(raw))]
				: isEmpty(raw)
					? []
					: [String(raw)];
		} catch {
			return { error: 'Invalid selection' };
		}

		if (!selected.length) {
			return field.required ? { error: 'Required' } : { value: null };
		}

		const allowed = field.options.values ?? [];

		if (selected.some((value) => !allowed.includes(value))) {
			return { error: 'Choose an item from the list' };
		}

		// Stored in the order of the list, so the same selection always gives the same value.
		const ordered = allowed.filter((value) => selected.includes(value));

		return { value: field.options.multiple ? JSON.stringify(ordered) : ordered[0] };
	}

	if (isEmpty(raw)) {
		return field.required ? { error: 'Required' } : { value: null };
	}

	// The API may send JSON fields as values instead of JSON text.
	const text = field.type === 'json' && typeof raw !== 'string' ? JSON.stringify(raw) : String(raw);

	switch (field.type) {
		case 'number': {
			const number = Number(text);
			return Number.isFinite(number) ? { value: number } : { error: 'Enter a number' };
		}
		case 'integer': {
			const number = Number(text);
			return Number.isInteger(number) ? { value: number } : { error: 'Enter a whole number' };
		}
		case 'date': {
			// `datetime-local` inputs send no timezone; dates are stored and edited in UTC.
			const time = Date.parse(/T\d{2}:\d{2}(:\d{2})?$/.test(text) ? `${text}Z` : text);
			return Number.isNaN(time)
				? { error: 'Enter a valid date' }
				: { value: new Date(time).toISOString() };
		}
		case 'email':
			return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
				? { value: text }
				: { error: 'Enter an email address' };
		case 'url':
			return URL.canParse(text)
				? { value: text }
				: { error: 'Enter a URL, e.g. https://example.com' };
		case 'json':
			try {
				return { value: JSON.stringify(JSON.parse(text)) };
			} catch {
				return { error: 'Enter valid JSON' };
			}
		default:
			return { value: text };
	}
}

/** A stored value as the records API returns it (see `ApiRecord`). */
export function decodeValue(field: Field, value: unknown): unknown {
	if (value === null || value === undefined) {
		return isMultiple(field) ? [] : null;
	}

	if (field.type === 'boolean') {
		return Number(value) === 1;
	}

	if (field.type === 'json' || isMultiple(field)) {
		try {
			const parsed: unknown = JSON.parse(String(value));
			return isMultiple(field) && !Array.isArray(parsed) ? [parsed] : parsed;
		} catch {
			return isMultiple(field) ? [String(value)] : value;
		}
	}

	return value;
}

/**
 * The fields Pouchbase fills in: the `id` field (`null` when removed), and the timestamps set when
 * a record is created or saved. `key` is the column records are found by: the `id` field, or
 * SQLite's `rowid`.
 */
export function autoFields(collectionFields: Field[]) {
	const idField = collectionFields.find((field) => field.type === 'id');
	const id = idField?.name ?? null;
	const names = (type: Field['type']) =>
		collectionFields.filter((field) => field.type === type).map((field) => field.name);

	return {
		id,
		generator: idField ? idGenerator(idField.options) : null,
		key: id ?? 'rowid',
		created: names('created'),
		updated: names('updated')
	};
}

/** Record keys as bound parameters; `rowid`s are integers, so other values can't match. */
export function keyParams(key: string, ids: string[]) {
	return key === 'rowid' ? ids.map(Number).filter(Number.isSafeInteger) : ids;
}

/** `?, ?, ?` for these parameters. */
export function placeholders(params: unknown[]) {
	return params.map(() => '?').join(', ');
}

/** The columns a computed field's script can read: all but blobs. */
export function readableColumns(collectionFields: Field[]) {
	return collectionFields.filter((field) => field.type !== 'blob').map((field) => field.name);
}

/** The fields the records API reads and filters on: all but blobs, which can be large. */
export function apiFields(collectionFields: Field[]) {
	return collectionFields.filter((field) => field.type !== 'blob');
}

/** A selected row (the key first, then every field) as a record of the grid. */
export function toRecord(collectionFields: Field[], row: unknown[]) {
	return {
		...Object.fromEntries(collectionFields.map((field, index) => [field.name, row[index + 1]])),
		_key: String(row[0])
	} as RecordRow;
}

/** A row with the columns of `selected`, in order, as an API record. */
export function toApiRecord(selected: Field[], row: unknown[]) {
	return Object.fromEntries(
		selected.map((field, index) => [field.name, decodeValue(field, row[index])])
	) as ApiRecord;
}

/** Stored values by field name as the records API returns the record, e.g. for realtime events. */
export function apiRecord(collectionFields: Field[], values: Record<string, unknown>) {
	const readable = apiFields(collectionFields);

	return toApiRecord(
		readable,
		readable.map((field) => values[field.name])
	);
}

/** What a write returns: the key, then the API fields, for its realtime event. */
export function returning(key: string, collectionFields: Field[]) {
	return [`"${key}"`, ...apiFields(collectionFields).map((field) => `"${field.name}"`)].join(', ');
}

/** A column as the grid selects it: blobs can be large, so it only gets their size. */
export function columnExpression(field: Pick<Field, 'name' | 'type'>) {
	return field.type === 'blob' ? `length("${field.name}") AS "${field.name}"` : `"${field.name}"`;
}
