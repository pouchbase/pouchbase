import type { FieldOptions, FieldTypeId } from '#lib/fields/field-types.js';
import type { ContextError, ErrorOf, ServiceError } from './base.service';
import type { CollectionLookupError } from './collections.service';
import type { PluginsService } from './plugins.service';
import type { ResultAsync } from 'neverthrow';

import { and, eq, inArray, sql } from 'drizzle-orm';

import {
	canHide,
	COMPUTED_SOURCE_TYPES,
	computedOptions,
	FIELD_TYPES,
	fieldSettings,
	hasComputedSource,
	idGenerator,
	isAutoType,
	isMultiple,
	isPluginFieldType,
	isValidFieldName
} from '#lib/fields/field-types.js';

import {
	ComputeError,
	computedSpecs,
	createComputer,
	fillComputedColumns,
	type ComputedSpec
} from '../computed';
import { isUniqueViolation, queryDatabase } from '../db/query';
import { collections, fields } from '../db';
import { planFieldChanges } from '../fields/changes';
import {
	addColumn,
	checkDefaultExpression,
	columnSql,
	createUniqueIndex,
	DefaultExpressionError,
	dropUniqueIndex,
	fieldInput,
	fieldsOf,
	keptColumn,
	rebuildTable,
	removeColumn,
	renameColumn,
	renameColumns
} from '../fields/ddl';
import { pluginSnapshot } from '../fields/plugin-snapshot';
import { Service } from './base.service';

export { uniqueIndexName } from '../fields/ddl';

export type Field = typeof fields.$inferSelect;

export type CreateFieldInput = {
	name: string;
	type: FieldTypeId;
	required: boolean;
	unique: boolean;
	/** Leaves the field out of the records API for app users (see `fields.hidden`); `false` when missing. */
	hidden?: boolean;
	/** Empty or missing means no default. */
	defaultValue?: string;
	options: FieldOptions;
	/** Fields of built-in collections; they can't be renamed or deleted. */
	system?: boolean;
	/** Id of the new field; a publish keeps the id the field has on the development instance. */
	id?: string;
};

/** The settings of a field that `FieldsService.update` changes. */
export type FieldSettings = {
	/** Empty or missing means no default. */
	defaultValue?: string;
	options: FieldOptions;
};

/** Edits to one field, as made in the edit collection sheet. */
export type FieldChange = {
	id: string;
	name: string;
	required: boolean;
	unique: boolean;
	/** Whether only admins, API keys, plugins and API rules see the field; unchanged when missing. */
	hidden?: boolean;
	/** Drops the field, including its data. */
	remove: boolean;
};

/** What calling a plugin for its field type can fail with. */
type PluginFieldError =
	| ErrorOf<ReturnType<PluginsService['fieldType']>>
	| ErrorOf<ReturnType<PluginsService['writeFieldValues']>>;

export type FieldsError =
	| ContextError
	| CollectionLookupError
	| ServiceError<7000, 'FIELDS_FAILED'>
	| (ServiceError<7001, 'INVALID_FIELD_NAME'> & { data?: { id: string } })
	| (ServiceError<7002, 'FIELD_ALREADY_EXISTS'> & { data?: { id: string } })
	/** `data.message` says why: the form's message, or a plugin's reason for its own types. */
	| (ServiceError<7003, 'INVALID_DEFAULT_VALUE'> & { data: { message: string } })
	| ServiceError<7006, 'FIELD_NOT_FOUND'>
	| ServiceError<7009, 'INVALID_RELATION'>
	| ServiceError<7010, 'SYSTEM_FIELD'>
	| ServiceError<7011, 'INVALID_COMPUTED'>
	| (ServiceError<7012, 'FIELD_IN_USE'> & { data: { computed: string[] } })
	| ServiceError<7013, 'FILES_COLLECTION_UNAVAILABLE'>
	| (ServiceError<7015, 'DUPLICATE_VALUES'> & { data: { id: string } })
	| (ServiceError<7016, 'COMPUTE_FAILED'> & { data: { message: string } })
	| (ServiceError<7018, 'INVALID_LIST'> & { data: { message: string } })
	| ServiceError<7019, 'INVALID_FIELD_TYPE'>
	| (ServiceError<7020, 'ID_FIELD_IN_USE'> & { data: { relations: string[] } })
	| ServiceError<7022, 'ID_FIELD_ALREADY_EXISTS'>
	| (ServiceError<7023, 'INVALID_DEFAULT_EXPRESSION'> & { data: { message: string } })
	| ServiceError<7024, 'UNIQUE_MULTIPLE'>
	| ServiceError<7025, 'MULTIPLE_VALUES_IN_USE'>
	| (ServiceError<7026, 'LIST_ITEMS_IN_USE'> & { data: { items: string[] } })
	| PluginFieldError;

/** The field named `name` in `collectionFields`. */
function fieldNamed(collectionFields: Field[], name: string) {
	return collectionFields.find((field) => field.name === name);
}

/**
 * The fields of a collection and the columns of its table (`../fields/ddl.ts`), kept in sync: a
 * field is a row in `fields` and a column in the collection's table in the app database.
 */
export class FieldsService extends Service {
	list(collectionId: string): ResultAsync<Field[], ServiceError<7000, 'FIELDS_FAILED'>> {
		return this.run(
			() => fieldsOf(collectionId),
			(error) => this.error(7000, 'FIELDS_FAILED', error)
		);
	}

	/**
	 * Adds a column to the collection's table and registers the field. The first field of a
	 * collection creates its table; an `id` field rebuilds an existing table (see `addPrimaryKey`).
	 *
	 * `required` is enforced when records are saved: SQLite can't add a NOT NULL column without a
	 * default to an existing table. `unique` becomes a UNIQUE INDEX, because ADD COLUMN can't be UNIQUE.
	 */
	create(collectionName: string, input: CreateFieldInput): ResultAsync<Field, FieldsError> {
		return this.run(async () => {
			if (!isValidFieldName(input.name)) {
				this.fail(7001, 'INVALID_FIELD_NAME');
			}

			if (isPluginFieldType(input.type)) {
				// The type must be installed; its label and column are kept with the field.
				const snapshot = await pluginSnapshot(
					this.services.plugins(),
					input.type,
					input.name,
					input.defaultValue,
					input.options.plugin?.column
				);

				input = {
					...input,
					defaultValue: snapshot.defaultValue,
					options: { ...input.options, plugin: snapshot.plugin }
				};
			} else if (!Object.hasOwn(FIELD_TYPES, input.type)) {
				this.fail(7019, 'INVALID_FIELD_TYPE');
			}

			if (input.type === 'relation' && !input.options.collectionId) {
				this.fail(7009, 'INVALID_RELATION');
			}

			if (input.type === 'computed' && !computedOptions(input.options)) {
				this.fail(7011, 'INVALID_COMPUTED');
			}

			const { options, defaultValue } = this.settings(
				input.type,
				input.defaultValue,
				input.options
			);
			const filled = input.type === 'computed' || isAutoType(input.type);

			input = {
				...input,
				options,
				defaultValue,
				// A JSON array can't meaningfully be unique, and every upload is a new file anyway.
				unique:
					input.unique &&
					!isMultiple({ type: input.type, options }) &&
					input.type !== 'file' &&
					!isAutoType(input.type),
				// Computed and automatic values are always filled in, so they can't be required.
				required: input.required && !filled,
				hidden: canHide({ type: input.type, system: input.system ?? false }) && !!input.hidden
			};

			const collection = await this.requireCollection(collectionName);

			if (input.type === 'file') {
				// File fields always point to the built-in `files` collection, whatever was submitted.
				const files = await this.services.files().ensureFilesCollection();

				if (files.isErr()) {
					// Its own code: the files collection is itself set up with this method.
					this.fail(7013, 'FILES_COLLECTION_UNAVAILABLE', { data: files.error });
				}

				options.collectionId = files.value.id;
			}

			if (input.type === 'relation') {
				// Relations store the related record's id, so the target needs an `id` field.
				const target = await this.must(this.services.collections().getById(options.collectionId!));
				const targetFields = target ? await fieldsOf(target.id) : [];

				if (!targetFields.some((field) => field.type === 'id')) {
					this.fail(7009, 'INVALID_RELATION');
				}
			}

			const collectionFields = await fieldsOf(collection.id);

			// The id field is the table's primary key, and a table has only one.
			if (input.type === 'id' && collectionFields.some((field) => field.type === 'id')) {
				this.fail(7022, 'ID_FIELD_ALREADY_EXISTS');
			}

			const computed =
				input.type === 'computed'
					? {
							spec: await this.computedSpec(collectionFields, input.name, options),
							columns: readableColumns(collectionFields)
						}
					: null;

			if (fieldNamed(collectionFields, input.name)) {
				this.fail(7002, 'FIELD_ALREADY_EXISTS');
			}

			const { id: databaseId } = await this.must(this.services.database().requireApp());
			const id = input.id ?? crypto.randomUUID();

			await addColumn(databaseId, collection, { ...input, id }, computed);

			// New fields go last.
			const [{ position }] = await this.db
				.select({ position: sql<number>`coalesce(max(${fields.position}), -1) + 1` })
				.from(fields)
				.where(eq(fields.collectionId, collection.id));

			const [field] = await this.db
				.insert(fields)
				.values({
					id,
					collectionId: collection.id,
					name: input.name,
					type: input.type,
					required: input.required,
					unique: input.unique,
					hidden: input.hidden ?? false,
					defaultValue: input.defaultValue || null,
					options,
					system: input.system ?? false,
					position
				})
				.returning();

			return field;
		}, this.failed);
	}

	/**
	 * Changes how a computed field is calculated and recalculates it for every record. When a
	 * record fails (a script error, or a duplicate value in a unique field), nothing is changed.
	 */
	updateComputed(
		collectionName: string,
		name: string,
		input: FieldOptions
	): ResultAsync<Field, FieldsError> {
		return this.run(async () => {
			const options = computedOptions(input);

			if (!options) {
				this.fail(7011, 'INVALID_COMPUTED');
			}

			const collection = await this.requireCollection(collectionName);
			const collectionFields = await fieldsOf(collection.id);
			const field = fieldNamed(collectionFields, name);

			if (!field || field.type !== 'computed') {
				this.fail(7006, 'FIELD_NOT_FOUND');
			}

			const spec = await this.computedSpec(collectionFields, name, options);
			const { id: databaseId } = await this.must(this.services.database().requireApp());
			const columns = readableColumns(collectionFields);
			const previous = computedSpecs(collectionFields).filter((other) => other.name === name);

			try {
				await fillComputedColumns(databaseId, collection.name, columns, [spec]);
			} catch (error) {
				// Put the old values back; a failure here leaves empty values.
				await fillComputedColumns(databaseId, collection.name, columns, previous, {
					lenient: true
				}).catch(() => undefined);

				if (isUniqueViolation(error)) {
					throw new ComputeError(name, 'Some records would get the same value');
				}

				throw error;
			}

			const [updated] = await this.db
				.update(fields)
				.set({ options })
				.where(eq(fields.id, field.id))
				.returning();

			return updated;
		}, this.failed);
	}

	/**
	 * Changes the settings of a field that depend on its type: its default value (also `@now` or a
	 * SQL expression), list items, accepted file types and size, rich text format, id generator,
	 * whether a relation or list allows multiple values, and what deleting a related record does.
	 * The type, the related collection and a computation (see `updateComputed`) can't change here.
	 *
	 * When the column definition changes (its DEFAULT or CHECK), the table is rebuilt and records
	 * keep their data; a single value becomes a one-item array when "multiple" is turned on.
	 * Changes that would lose data are refused.
	 */
	update(
		collectionName: string,
		name: string,
		input: FieldSettings
	): ResultAsync<Field, FieldsError> {
		return this.run(async () => {
			const collection = await this.requireCollection(collectionName);
			const collectionFields = await fieldsOf(collection.id);
			const field = fieldNamed(collectionFields, name);

			if (!field) {
				this.fail(7006, 'FIELD_NOT_FOUND');
			}

			if (field.system) {
				this.fail(7010, 'SYSTEM_FIELD');
			}

			// Computations have `updateComputed`; timestamps have no settings.
			if (field.type === 'computed' || field.type === 'created' || field.type === 'updated') {
				this.fail(7019, 'INVALID_FIELD_TYPE');
			}

			// An auto-increment id is an INTEGER column, the other generators make text.
			if (
				field.type === 'id' &&
				(idGenerator(field.options) === 'autoincrement') !==
					(input.options.generator === 'autoincrement')
			) {
				this.fail(7019, 'INVALID_FIELD_TYPE');
			}

			// A plugin's type must still be installed: it checks the default value.
			const prepared = isPluginFieldType(field.type)
				? await pluginSnapshot(
						this.services.plugins(),
						field.type,
						field.name,
						input.defaultValue,
						field.options.plugin?.column
					)
				: null;

			const settings = this.settings(
				field.type,
				prepared ? prepared.defaultValue : input.defaultValue,
				{
					...input.options,
					// The related collection stays.
					collectionId: field.options.collectionId,
					...(prepared && { plugin: prepared.plugin })
				}
			);
			const next: Field = {
				...field,
				options: settings.options,
				defaultValue: settings.defaultValue ?? null
			};
			const wasMultiple = isMultiple(field);
			const multiple = isMultiple(next);

			// A JSON array can't meaningfully be unique (see `create`).
			if (multiple && field.unique) {
				this.fail(7024, 'UNIQUE_MULTIPLE');
			}

			const removedItems =
				field.type === 'list'
					? (field.options.values ?? []).filter((item) => !next.options.values?.includes(item))
					: [];
			const { id: databaseId } = await this.must(this.services.database().requireApp());
			const table = `"${collection.name}"`;
			const column = `"${field.name}"`;

			if (wasMultiple && !multiple) {
				const [crowded] = await queryDatabase(
					databaseId,
					`SELECT 1 FROM ${table} WHERE json_array_length(${column}) > 1 LIMIT 1`
				);

				if (crowded) {
					this.fail(7025, 'MULTIPLE_VALUES_IN_USE');
				}
			}

			if (removedItems.length) {
				const placeholders = removedItems.map(() => '?').join(', ');
				const used = await queryDatabase(
					databaseId,
					wasMultiple
						? `SELECT DISTINCT "item"."value" FROM ${table}, json_each(${table}.${column}) AS "item" WHERE "item"."value" IN (${placeholders})`
						: `SELECT DISTINCT ${column} FROM ${table} WHERE ${column} IN (${placeholders})`,
					removedItems
				);

				if (used.length) {
					this.fail(7026, 'LIST_ITEMS_IN_USE', {
						data: { items: used.map(([item]) => String(item)) }
					});
				}
			}

			if (next.options.defaultSql) {
				await checkDefaultExpression(databaseId, fieldInput(next));
			}

			if (columnSql(fieldInput(field)) !== columnSql(fieldInput(next))) {
				const source =
					multiple && !wasMultiple
						? `CASE WHEN ${column} IS NULL THEN NULL ELSE json_array(${column}) END`
						: wasMultiple && !multiple
							? `json_extract(${column}, '$[0]')`
							: column;

				await rebuildTable(
					databaseId,
					collection.name,
					collectionFields.map((other) =>
						other.id === field.id
							? { definition: columnSql(fieldInput(next)), name: other.name, source }
							: keptColumn(other)
					)
				);
			}

			const [updated] = await this.db
				.update(fields)
				.set({ defaultValue: next.defaultValue, options: next.options })
				.where(eq(fields.id, field.id))
				.returning();

			return updated;
		}, this.failed);
	}

	/** Renames the column; its CHECK constraint and unique index follow automatically. */
	rename(collectionName: string, name: string, newName: string): ResultAsync<Field, FieldsError> {
		return this.run(async () => {
			const collection = await this.requireCollection(collectionName);
			const collectionFields = await fieldsOf(collection.id);
			const field = fieldNamed(collectionFields, name);

			if (!field) {
				this.fail(7006, 'FIELD_NOT_FOUND');
			}

			if (field.system) {
				this.fail(7010, 'SYSTEM_FIELD');
			}

			if (!isValidFieldName(newName)) {
				this.fail(7001, 'INVALID_FIELD_NAME');
			}

			if (newName === field.name) {
				return field;
			}

			if (fieldNamed(collectionFields, newName)) {
				this.fail(7002, 'FIELD_ALREADY_EXISTS');
			}

			const { id: databaseId } = await this.must(this.services.database().requireApp());

			return renameColumn(databaseId, collection, field, newName);
		}, this.failed);
	}

	/**
	 * Drops the column, including its data.
	 *
	 * @param options.allowSystem Internal: lets built-in setup code remove an outdated system field.
	 */
	delete(
		collectionName: string,
		name: string,
		options: { allowSystem?: boolean } = {}
	): ResultAsync<void, FieldsError> {
		return this.run(async () => {
			const collection = await this.requireCollection(collectionName);
			const collectionFields = await fieldsOf(collection.id);
			const field = fieldNamed(collectionFields, name);

			if (!field) {
				this.fail(7006, 'FIELD_NOT_FOUND');
			}

			if (field.system && !options.allowSystem) {
				this.fail(7010, 'SYSTEM_FIELD');
			}

			this.requireUnused(collectionFields, field.name);

			if (field.type === 'id') {
				await this.requireIdUnused(collection.id);
			}

			const { id: databaseId } = await this.must(this.services.database().requireApp());

			await removeColumn(databaseId, collection, field);
		}, this.failed);
	}

	/**
	 * Applies all changes of the edit collection sheet in one go: removes, renames, `required`,
	 * `unique` and `hidden`, and the display order, which follows the order of `changes` (fields
	 * left out keep their order after them). System fields can only be moved. Removing the `id`
	 * field rebuilds the table; records keep their `rowid`. Removing every field drops the table.
	 *
	 * Unique indexes are created first, as that is the step most likely to fail (duplicate values).
	 */
	updateAll(collectionName: string, changes: FieldChange[]): ResultAsync<void, FieldsError> {
		return this.run(async () => {
			const collection = await this.requireCollection(collectionName);
			const { kept, removed } = planFieldChanges(await fieldsOf(collection.id), changes);

			if (removed.some((plan) => plan.field.type === 'id')) {
				await this.requireIdUnused(
					collection.id,
					removed.map((plan) => plan.field.id)
				);
			}

			const { id: databaseId } = await this.must(this.services.database().requireApp());

			for (const plan of kept) {
				if (plan.unique && !plan.field.unique) {
					try {
						await createUniqueIndex(databaseId, collection.name, plan.field);
					} catch {
						this.fail(7015, 'DUPLICATE_VALUES', { data: { id: plan.field.id } });
					}
				}

				if (!plan.unique && plan.field.unique) {
					await dropUniqueIndex(databaseId, plan.field);
				}
			}

			for (const plan of removed) {
				await removeColumn(databaseId, collection, plan.field);
			}

			await renameColumns(databaseId, collection, kept);

			for (const [position, plan] of kept.entries()) {
				await this.db
					.update(fields)
					.set({ required: plan.required, unique: plan.unique, hidden: plan.hidden, position })
					.where(eq(fields.id, plan.field.id));
			}
		}, this.failed);
	}

	/** The collection with this name, or `COLLECTION_NOT_FOUND`. */
	private requireCollection(name: string) {
		return this.must(this.services.collections().requireByName(name));
	}

	/**
	 * The options and default value of a field of this type, checked and cleaned up (see
	 * `fieldSettings`). Shared by `create` and `update`.
	 */
	private settings(type: FieldTypeId, defaultValue: string | undefined, input: FieldOptions) {
		const settings = fieldSettings(type, defaultValue, input);
		const [issue] = settings.issues;

		switch (issue?.kind) {
			case 'generator':
				this.fail(7019, 'INVALID_FIELD_TYPE');
				break;
			case 'expression':
				this.fail(7023, 'INVALID_DEFAULT_EXPRESSION', { data: { message: issue.message } });
				break;
			case 'list':
				this.fail(7018, 'INVALID_LIST', { data: { message: issue.message } });
				break;
			case 'default':
				this.fail(7003, 'INVALID_DEFAULT_VALUE', { data: { message: issue.message } });
				break;
		}

		return settings;
	}

	/**
	 * Checks a computed field's options against the collection: the source must be a field whose
	 * value can be turned into text, and a script must compile.
	 */
	private async computedSpec(
		collectionFields: Field[],
		name: string,
		options: FieldOptions
	): Promise<ComputedSpec> {
		const transform = options.transform!;

		if (hasComputedSource(transform)) {
			const source = fieldNamed(collectionFields, options.source ?? '');

			if (!source || source.name === name || !COMPUTED_SOURCE_TYPES.has(source.type)) {
				this.fail(7011, 'INVALID_COMPUTED');
			}

			return { name, transform, source: { name: source.name, type: source.type } };
		}

		const spec: ComputedSpec = { name, transform, script: options.script };

		try {
			(await createComputer('', [spec])).dispose();
		} catch (error) {
			throw error instanceof ComputeError ? error : new ComputeError(name, String(error));
		}

		return spec;
	}

	/**
	 * Fails when relation fields point to this collection: they store the `id` of its records, so
	 * the `id` field must stay. Fields in `ignore` (removed in the same save) don't count.
	 */
	private async requireIdUnused(collectionId: string, ignore: string[] = []) {
		const references = await this.db
			.select({ id: fields.id, name: fields.name, collection: collections.name })
			.from(fields)
			.innerJoin(collections, eq(collections.id, fields.collectionId))
			.where(
				and(
					inArray(fields.type, ['relation', 'file']),
					sql`json_extract(${fields.options}, '$.collectionId') = ${collectionId}`
				)
			);
		const relations = references
			.filter((reference) => !ignore.includes(reference.id))
			.map((reference) => `${reference.collection}.${reference.name}`);

		if (relations.length) {
			this.fail(7020, 'ID_FIELD_IN_USE', { data: { relations } });
		}
	}

	/** Fails when computed fields are calculated from this field; they must be removed first. */
	private requireUnused(collectionFields: Field[], name: string) {
		const computed = collectionFields
			.filter((field) => field.type === 'computed' && field.options.source === name)
			.map((field) => field.name);

		if (computed.length) {
			this.fail(7012, 'FIELD_IN_USE', { data: { computed } });
		}
	}

	/** The error of anything thrown that isn't a `Failure`: computing and SQL defaults have their own codes. */
	private readonly failed = (error: unknown): FieldsError => {
		if (error instanceof ComputeError) {
			return { code: 7016, message: 'COMPUTE_FAILED', data: { message: error.message } };
		}

		if (error instanceof DefaultExpressionError) {
			return {
				code: 7023,
				message: 'INVALID_DEFAULT_EXPRESSION',
				data: { message: error.message }
			};
		}

		return this.error(7000, 'FIELDS_FAILED', error);
	};
}
