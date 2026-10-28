/** SQLite's names for the hidden row key; field names can't use them. */
const RESERVED_NAMES = new Set<string>(['rowid', 'oid', '_rowid_']);

/**
 * Field names are column names, so they are restricted to a safe identifier. They can't start
 * with `_`: temporary column names during a rebuild or rename start with it.
 */
export const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

export function isReservedFieldName(name: string) {
	return RESERVED_NAMES.has(name);
}

/** Whether `name` can be a field (column) name. */
export function isValidFieldName(name: string) {
	return FIELD_NAME_PATTERN.test(name) && !isReservedFieldName(name);
}
