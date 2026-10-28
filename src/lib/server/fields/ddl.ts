import type { ComputedSpec } from '../computed';
import type { CreateFieldInput, Field } from '../services/fields.service';

import { and, asc, eq } from 'drizzle-orm';

import { fieldTypeInfo } from '#lib/fields/field-type-info.js';
import {
	idGenerator,
	isMultiple,
	isPluginFieldType,
	NOW_DEFAULT,
	type FieldTypeId
} from '#lib/fields/field-types.js';
import { sqlDefaultSelect } from '#lib/fields/sql-expression.js';

import { fillComputedColumns } from '../computed';
import { generateId } from '../crypto';
import { queryDatabase, tableExists } from '../db/query';
import { db, fields } from '../db';

/**
 * The columns of a collection's table: SQL for the column of a field, and the ALTER TABLE and
 * rebuild steps that keep the table and the `fields` rows in sync. Everything throws on database
 * errors; the fields service maps them to its codes.
 */

/** Records given an id per query when an `id` field is added: 3 bound parameters each. */
const ID_FILL_SIZE = 30;

function quote(value: string) {
	return `'${value.replaceAll("'", "''")}'`;
}

/** SQL literal for a (validated) default value. */
export function defaultLiteral(type: FieldTypeId, value: string) {
	switch (type) {
		case 'number':
			return String(Number(value));
		case 'integer':
			return String(Number.parseInt(value, 10));
		case 'boolean':
			return value === 'true' ? '1' : '0';
		case 'date':
			return quote(new Date(value).toISOString());
		case 'json':
			return quote(JSON.stringify(JSON.parse(value)));
		default:
			return quote(value);
	}
}

/** The column definition input for a stored field. */
export function fieldInput(field: Field): CreateFieldInput {
	return { ...field, defaultValue: field.defaultValue ?? undefined };
}

/**
 * Column definition for `CREATE TABLE`, `ALTER TABLE ... ADD COLUMN` or a rebuilt table.
 *
 * @param options.nullableKey Leaves `NOT NULL` off a text `id` column, so a rebuilt table can be
 *   filled before the existing records get their id.
 */
export function columnSql(input: CreateFieldInput, options: { nullableKey?: boolean } = {}) {
	if (input.type === 'id') {
		// AUTOINCREMENT: numbers of deleted records are never handed out again.
		return idGenerator(input.options) === 'autoincrement'
			? `"${input.name}" INTEGER PRIMARY KEY AUTOINCREMENT`
			: `"${input.name}" TEXT PRIMARY KEY${options.nullableKey ? '' : ' NOT NULL'}`;
	}

	const parts = [`"${input.name}"`, fieldTypeInfo(input).column];

	// A plugin's type: the column's DEFAULT is the default value as the plugin serialized it.
	if (isPluginFieldType(input.type)) {
		const value = input.options.plugin?.default;

		if (value !== undefined) {
			parts.push(`DEFAULT ${typeof value === 'number' ? String(value) : quote(value)}`);
		}

		return parts.join(' ');
	}

	// `@now` and SQL expressions are filled in when a record is created: ADD COLUMN can't have a
	// non-constant DEFAULT.
	if (input.defaultValue && input.defaultValue !== NOW_DEFAULT && !input.options.defaultSql) {
		// A multiple relation or list starts with an array of the one default id or item.
		parts.push(
			isMultiple(input)
				? `DEFAULT ${quote(JSON.stringify([input.defaultValue]))}`
				: `DEFAULT ${defaultLiteral(input.type, input.defaultValue)}`
		);
	}

	if (input.type === 'boolean') {
		parts.push(`CHECK ("${input.name}" IN (0, 1))`);
	}

	if (input.type === 'json' || isMultiple(input)) {
		parts.push(`CHECK (json_valid("${input.name}"))`);
	}

	return parts.join(' ');
}

/** Named after the field id, so it survives renaming the field or the collection. */
export function uniqueIndexName(field: Pick<Field, 'id'>) {
	return `uq_${field.id.replaceAll('-', '')}`;
}

/** A column copied as is when a table is rebuilt. */
export function keptColumn(field: Field) {
	return { definition: columnSql(fieldInput(field)), name: field.name, source: `"${field.name}"` };
}

/** SQLite refused to add a column because the table already has it. */
export function isDuplicateColumn(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);

	return message.includes('duplicate column name');
}

/** A default value expression that isn't allowed or doesn't run, with a message for the form. */
export class DefaultExpressionError extends Error {}

/**
 * Evaluates a default expression once, so a typo or an unsupported function is reported when the
 * field is added, not when records are created. Throws a `DefaultExpressionError`.
 */
export async function checkDefaultExpression(databaseId: string, input: CreateFieldInput) {
	let value: unknown;

	try {
		[[value]] = await queryDatabase(
			databaseId,
			`SELECT ${sqlDefaultSelect(input.type, input.defaultValue!)}`
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		throw new DefaultExpressionError(`SQLite can't run this expression: ${message}`);
	}

	if (input.type === 'date' && value === null) {
		throw new DefaultExpressionError(
			"This expression doesn't give a date, e.g. use datetime('now', '+7 days')"
		);
	}
}

/** The fields of a collection in display order, from the system database. */
export function fieldsOf(collectionId: string) {
	return db
		.select()
		.from(fields)
		.where(eq(fields.collectionId, collectionId))
		.orderBy(asc(fields.position), asc(fields.createdAt));
}

/** Creates the unique index of a "Unique" field. */
export function createUniqueIndex(
	databaseId: string,
	table: string,
	field: Pick<Field, 'id' | 'name'>
) {
	return queryDatabase(
		databaseId,
		`CREATE UNIQUE INDEX "${uniqueIndexName(field)}" ON "${table}" ("${field.name}")`
	);
}

/** Drops the unique index of a field, if it has one. */
export function dropUniqueIndex(databaseId: string, field: Pick<Field, 'id'>) {
	return queryDatabase(databaseId, `DROP INDEX IF EXISTS "${uniqueIndexName(field)}"`);
}

/** Renames the column and the field; computed fields follow their source to the new name. */
export async function renameColumn(
	databaseId: string,
	collection: { id: string; name: string },
	field: Field,
	newName: string
) {
	await queryDatabase(
		databaseId,
		`ALTER TABLE "${collection.name}" RENAME COLUMN "${field.name}" TO "${newName}"`
	);

	const [renamed] = await db
		.update(fields)
		.set({ name: newName })
		.where(eq(fields.id, field.id))
		.returning();

	const computed = await db
		.select()
		.from(fields)
		.where(and(eq(fields.collectionId, collection.id), eq(fields.type, 'computed')));

	for (const dependent of computed) {
		if (dependent.options.source === field.name) {
			await db
				.update(fields)
				.set({ options: { ...dependent.options, source: newName } })
				.where(eq(fields.id, dependent.id));
		}
	}

	return renamed;
}

/**
 * Drops a field's column, including its data, and the field. The last field takes the table with
 * it: SQLite tables need at least one column.
 */
export async function removeColumn(
	databaseId: string,
	collection: { id: string; name: string },
	field: Field
) {
	const others = (await fieldsOf(collection.id)).filter((other) => other.id !== field.id);

	if (!others.length) {
		await queryDatabase(databaseId, `DROP TABLE IF EXISTS "${collection.name}"`);
	} else if (field.type === 'id') {
		// SQLite can't drop a primary key column.
		await rebuildTable(databaseId, collection.name, others.map(keptColumn), field.name);
	} else {
		await dropColumn(databaseId, collection, field);

		return;
	}

	await db.delete(fields).where(eq(fields.id, field.id));
}

/** Drops the column, including its data, and the field. */
async function dropColumn(
	databaseId: string,
	collection: { name: string },
	field: Pick<Field, 'id' | 'name'>
) {
	// SQLite can't drop a column that is part of an index, so drop every index that uses it: its
	// own unique index and custom indexes.
	const indexes = await queryDatabase(
		databaseId,
		`SELECT DISTINCT il.name FROM pragma_index_list(?) AS il JOIN pragma_index_info(il.name) AS ii WHERE ii.name = ? AND il.origin != 'pk'`,
		[collection.name, field.name]
	);

	for (const [name] of indexes) {
		await queryDatabase(databaseId, `DROP INDEX IF EXISTS "${String(name)}"`);
	}

	await queryDatabase(databaseId, `ALTER TABLE "${collection.name}" DROP COLUMN "${field.name}"`);
	await db.delete(fields).where(eq(fields.id, field.id));
}

/**
 * Adds an `id` field's column to a table that already exists. SQLite can't add a primary key
 * column, so the table is rebuilt with it, and existing records get a generated id: their
 * `rowid` for `autoincrement`.
 */
export async function addPrimaryKey(
	databaseId: string,
	collection: { id: string; name: string },
	input: CreateFieldInput
) {
	const generator = idGenerator(input.options);
	const collectionFields = await fieldsOf(collection.id);

	await rebuildTable(databaseId, collection.name, [
		{
			// Left empty while copying, then filled below.
			definition: columnSql(input, { nullableKey: true }),
			name: input.name,
			source: generator === 'autoincrement' ? 'rowid' : 'NULL'
		},
		...collectionFields.map(keptColumn)
	]);

	if (generator === 'autoincrement') {
		return;
	}

	for (;;) {
		const rows = await queryDatabase(
			databaseId,
			`SELECT rowid FROM "${collection.name}" WHERE "${input.name}" IS NULL LIMIT ?`,
			[ID_FILL_SIZE]
		);

		if (!rows.length) {
			return;
		}

		const ids = rows.map(([rowid]) => [Number(rowid), generateId(generator)] as const);

		await queryDatabase(
			databaseId,
			`UPDATE "${collection.name}" SET "${input.name}" = CASE rowid ${ids.map(() => 'WHEN ? THEN ?').join(' ')} END WHERE rowid IN (${ids.map(() => '?').join(', ')})`,
			[...ids.flat(), ...ids.map(([rowid]) => rowid)]
		);
	}
}

/**
 * Recreates a table with the given columns, copied from the `source` expressions. Every record
 * keeps its `rowid`, and indexes are recreated, except those on `droppedColumn`.
 */
export async function rebuildTable(
	databaseId: string,
	tableName: string,
	columns: { definition: string; name: string; source: string }[],
	droppedColumn = ''
) {
	const table = `"${tableName}"`;
	// Collection names can't start with `_`, so this never clashes with a collection.
	const temporary = `"_rebuild_${tableName}"`;
	const indexes = await queryDatabase(
		databaseId,
		`SELECT "sql" FROM sqlite_master WHERE "type" = 'index' AND "tbl_name" = ? AND "sql" IS NOT NULL AND "name" NOT IN (SELECT il.name FROM pragma_index_list(?) AS il JOIN pragma_index_info(il.name) AS ii WHERE ii.name = ?)`,
		[tableName, tableName, droppedColumn]
	);
	// Columns without a field would be lost; that never happens on purpose.
	const kept = new Set([...columns.map((column) => column.name), droppedColumn]);
	const unknown = (
		await queryDatabase(databaseId, `SELECT "name" FROM pragma_table_info(?)`, [tableName])
	)
		.map(([name]) => String(name))
		.filter((name) => !kept.has(name));

	if (unknown.length) {
		throw new Error(`"${tableName}" has columns without a field: ${unknown.join(', ')}`);
	}

	const names = ['rowid', ...columns.map((column) => `"${column.name}"`)].join(', ');
	const sources = ['rowid', ...columns.map((column) => column.source)].join(', ');

	await queryDatabase(databaseId, `DROP TABLE IF EXISTS ${temporary}`);
	await queryDatabase(
		databaseId,
		`CREATE TABLE ${temporary} (${columns.map((column) => column.definition).join(', ')})`
	);

	try {
		await queryDatabase(
			databaseId,
			`INSERT INTO ${temporary} (${names}) SELECT ${sources} FROM ${table}`
		);
	} catch (error) {
		await queryDatabase(databaseId, `DROP TABLE IF EXISTS ${temporary}`);
		throw error;
	}

	await queryDatabase(databaseId, `DROP TABLE ${table}`);
	await queryDatabase(databaseId, `ALTER TABLE ${temporary} RENAME TO ${table}`);

	for (const [statement] of indexes) {
		await queryDatabase(databaseId, String(statement));
	}
}

/**
 * Adds the column of a new field: the first field creates the table, an `id` field rebuilds it
 * (`addPrimaryKey`), other fields are added with ALTER TABLE. Then fills a computed field and
 * creates the unique index; when either fails, the column (or table) is dropped again, so the
 * table and the field list stay in sync.
 */
export async function addColumn(
	databaseId: string,
	collection: { id: string; name: string },
	input: CreateFieldInput & { id: string },
	computed: { spec: ComputedSpec; columns: string[] } | null
) {
	const table = `"${collection.name}"`;

	if (input.options.defaultSql) {
		await checkDefaultExpression(databaseId, input);
	}

	// The first field creates the table: SQLite tables need at least one column.
	const created = !(await tableExists(databaseId, collection.name));

	if (created) {
		await queryDatabase(databaseId, `CREATE TABLE ${table} (${columnSql(input)})`);
	} else if (input.type === 'id') {
		await addPrimaryKey(databaseId, collection, input);
	} else {
		try {
			await queryDatabase(databaseId, `ALTER TABLE ${table} ADD COLUMN ${columnSql(input)}`);
		} catch (error) {
			// The field doesn't exist, so a column with its name was left by an earlier attempt that
			// was cut off before it saved the field (e.g. a first install that hit the Worker's
			// subrequest limit). The field takes it over.
			if (!isDuplicateColumn(error)) {
				throw error;
			}
		}
	}

	try {
		if (computed) {
			// Existing records get their value right away.
			await fillComputedColumns(databaseId, collection.name, computed.columns, [computed.spec]);
		}

		if (input.unique) {
			await createUniqueIndex(databaseId, collection.name, input);
		}
	} catch (error) {
		await queryDatabase(
			databaseId,
			created ? `DROP TABLE ${table}` : `ALTER TABLE ${table} DROP COLUMN "${input.name}"`
		);
		throw error;
	}
}

/**
 * Renames the fields whose planned name differs. When a new name is still taken by another field
 * (e.g. two names swapped), they go through temporary names; field names can't start with `_`.
 */
export async function renameColumns(
	databaseId: string,
	collection: { id: string; name: string },
	kept: { field: Field; name: string }[]
) {
	const renamed = kept.filter((plan) => plan.name !== plan.field.name);
	const currentNames = new Set(kept.map((plan) => plan.field.name));
	const swap = renamed.some((plan) => currentNames.has(plan.name));
	const temporary = (field: Field) => `_tmp_${field.id.replaceAll('-', '')}`;

	if (swap) {
		for (const plan of renamed) {
			await renameColumn(databaseId, collection, plan.field, temporary(plan.field));
		}
	}

	for (const plan of renamed) {
		await renameColumn(
			databaseId,
			collection,
			swap ? { ...plan.field, name: temporary(plan.field) } : plan.field,
			plan.name
		);
	}
}
