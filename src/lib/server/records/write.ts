import type { PluginsService } from '../services/plugins.service';
import type { Field } from '../services/fields.service';
import type { FieldOptions } from '#lib/fields/field-types.js';
import type { RecordContext, RecordInput, RecordIssues, StoredValue } from './values';

import { isAutoType, isPluginFieldType, isRelationType } from '#lib/fields/field-types.js';
import { sqlDefaultSelect } from '#lib/fields/sql-expression.js';

import { ComputeError, computedSpecs, createComputer } from '../computed';
import { queryDatabase, queryObjects } from '../db/query';
import { Failure } from '../services/base.service';
import { pluginValues } from './plugin-values';
import { relationTarget } from './relations';
import {
	autoFields,
	keyParams,
	parseIds,
	parseValue,
	placeholders,
	readableColumns
} from './values';

/**
 * The values of a record about to be written: parsed, checked and completed. Every function
 * throws an `INVALID_RECORD` failure with the issues per field, or any other error of the
 * database and the plugins.
 */

/** The failure of a record whose values have problems: the message per field. */
export function invalidRecord(issues: RecordIssues) {
	return new Failure({ code: 8001, message: 'INVALID_RECORD', data: { issues } });
}

/**
 * Parses every field of the input, checks that related records exist and lets the plugins
 * check their fields. Blob fields are never written here.
 */
export async function validateInput(
	plugins: PluginsService,
	{ databaseId }: RecordContext,
	collectionFields: Field[],
	input: RecordInput,
	{ creating }: { creating: boolean }
): Promise<Record<string, StoredValue>> {
	const values: Record<string, StoredValue> = {};
	const issues: RecordIssues = {};

	for (const field of collectionFields) {
		// Their plugin checks them, below.
		if (
			field.type === 'blob' ||
			field.type === 'computed' ||
			isAutoType(field.type) ||
			isPluginFieldType(field.type)
		) {
			continue;
		}

		const parsed = parseValue(field, input[field.name]);

		if ('error' in parsed) {
			issues[field.name] = parsed.error;
		} else {
			values[field.name] = parsed.value;
		}
	}

	const relations = collectionFields.filter(
		(field) => isRelationType(field.type) && values[field.name] !== null && !issues[field.name]
	);

	for (const field of relations) {
		const target = await relationTarget(field.options.collectionId);
		const ids = parseIds(values[field.name]);

		if (!target) {
			issues[field.name] = 'The related collection no longer exists';
			continue;
		}

		if (!target.id) {
			issues[field.name] = 'The related collection has no id field';
			continue;
		}

		const found = await queryDatabase(
			databaseId,
			`SELECT "${target.id}" FROM "${target.collection.name}" WHERE "${target.id}" IN (${placeholders(ids)})`,
			ids
		);

		if (found.length !== new Set(ids).size) {
			issues[field.name] = 'A selected record no longer exists';
		}
	}

	const plugin = await pluginValues(plugins, collectionFields, input, creating);

	Object.assign(values, plugin.values);
	Object.assign(issues, plugin.issues);

	if (Object.keys(issues).length) {
		throw invalidRecord(issues);
	}

	return values;
}

/**
 * Values of the computed fields for a record about to be saved. A failing script becomes an
 * issue on its field.
 */
export async function computeValues(
	collectionName: string,
	collectionFields: Field[],
	record: Record<string, unknown>,
	previous: Record<string, unknown> | null
): Promise<Record<string, string | null>> {
	const specs = computedSpecs(collectionFields);

	if (!specs.length) {
		return {};
	}

	const computer = await createComputer(collectionName, specs);

	try {
		return computer.compute(record, previous);
	} catch (error) {
		if (error instanceof ComputeError) {
			throw invalidRecord({ [error.field]: error.message });
		}

		throw error;
	} finally {
		computer.dispose();
	}
}

/** A stored record with every column a script can read; `null` when it doesn't exist. */
export async function readStoredRecord(
	databaseId: string,
	table: string,
	collectionFields: Field[],
	id: string
): Promise<Record<string, unknown> | null> {
	const { key } = autoFields(collectionFields);
	const columns = readableColumns(collectionFields).map((name) => `"${name}"`);
	const [row] = await queryObjects(
		databaseId,
		`SELECT ${columns.join(', ')} FROM "${table}" WHERE "${key}" = ?`,
		keyParams(key, [id])
	);

	return row ?? null;
}

/**
 * Fills the empty fields whose default value is a SQL expression, evaluated on the app database
 * in one query, in place. The results are checked like submitted values; a bad result becomes
 * an issue on its field.
 */
export async function fillSqlDefaults(
	databaseId: string,
	collectionFields: Field[],
	values: Record<string, StoredValue>
): Promise<void> {
	const defaulted = collectionFields.filter(
		(field) => field.options.defaultSql && field.defaultValue && values[field.name] === null
	);

	if (!defaulted.length) {
		return;
	}

	const [row] = await queryDatabase(
		databaseId,
		`SELECT ${defaulted.map((field) => sqlDefaultSelect(field.type, field.defaultValue!)).join(', ')}`
	);
	const issues: RecordIssues = {};

	for (const [index, field] of defaulted.entries()) {
		const parsed = parseValue(field, row?.[index]);

		if ('error' in parsed) {
			issues[field.name] = `The default value gave an invalid value: ${parsed.error}`;
		} else {
			values[field.name] = parsed.value;
		}
	}

	if (Object.keys(issues).length) {
		throw invalidRecord(issues);
	}
}

/** What trying out a computed field gives: a compile error, or the value or error per record. */
export type ComputedPreview = {
	error?: string;
	rows: { id: string; value?: string | null; error?: string }[];
};

/**
 * Runs a computed field's calculation on the newest records without saving anything, so a
 * script can be tried out. `error` is set when the script doesn't compile.
 */
export async function previewComputed(
	{ collection, fields: collectionFields, databaseId }: RecordContext,
	options: FieldOptions
): Promise<ComputedPreview> {
	// Field names can't start with `_`, so this never shadows a real field.
	const [spec] = computedSpecs([
		...collectionFields,
		{ name: '_preview', type: 'computed', options }
	]).filter((candidate) => candidate.name === '_preview');

	if (!spec) {
		return { error: 'Choose a source field or write a script', rows: [] };
	}

	let computer;

	try {
		computer = await createComputer(collection.name, [spec]);
	} catch (error) {
		if (error instanceof ComputeError) {
			return { error: error.message, rows: [] };
		}

		throw error;
	}

	try {
		const { key, created } = autoFields(collectionFields);
		const columns = readableColumns(collectionFields).map((name) => `"${name}"`);
		// Field names can't start with `_`, so the alias never shadows a column.
		const rows = await queryObjects(
			databaseId,
			`SELECT ${[`"${key}" AS "_key"`, ...columns].join(', ')} FROM "${collection.name}" ORDER BY "${created[0] ?? key}" DESC LIMIT 5`
		);

		return {
			rows: rows.map(({ _key, ...row }) => {
				try {
					return { id: String(_key), value: computer.compute(row, row)._preview };
				} catch (error) {
					if (error instanceof ComputeError) {
						return { id: String(_key), error: error.message };
					}

					throw error;
				}
			})
		};
	} finally {
		computer.dispose();
	}
}
