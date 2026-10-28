import type { CollectionSettings } from '#lib/files/thumbnails.js';
import type { ApiRules } from '#lib/filter/rules.js';
import type { ContextError, ErrorOf, ServiceError } from './base.service';
import type { CreateFieldInput, Field, FieldsService } from './fields.service';
import type { RecordsService } from './records.service';
import type { ResultAsync } from 'neverthrow';

import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';

import { BUILT_IN_DEFAULT_FIELDS, isAutoType } from '#lib/fields/field-types.js';
import { apiActions } from '#lib/filter/rules.js';
import { isValidCollectionName } from '#lib/schemas/collections.js';

import { queryDatabase, tableExists } from '../db/query';
import { compileRule } from '../filter';
import { collections, fields } from '../db';
import { Service } from './base.service';

export type Collection = typeof collections.$inferSelect;

/** Reading a collection: the lookup failed, or there is no collection with the name. */
export type CollectionLookupError =
	ServiceError<6000, 'COLLECTIONS_FAILED'> | ServiceError<6006, 'COLLECTION_NOT_FOUND'>;

export type CollectionsError =
	| ContextError
	| CollectionLookupError
	| ServiceError<6002, 'INVALID_COLLECTION_NAME'>
	| ServiceError<6003, 'COLLECTION_ALREADY_EXISTS'>
	| ServiceError<6009, 'COLLECTION_IN_USE'>
	| ServiceError<6011, 'SYSTEM_COLLECTION'>
	| (ServiceError<6014, 'INVALID_API_RULES'> & { data: { issues: Record<string, string> } })
	| ErrorOf<ReturnType<FieldsService['create']>>
	| ErrorOf<ReturnType<RecordsService['filterRelations']>>;

/** The table of a built-in collection starts with the columns of `BUILT_IN_DEFAULT_FIELDS`. */
function createTableSql(name: string) {
	return `CREATE TABLE "${name}" (
	"id" TEXT PRIMARY KEY NOT NULL,
	"created_at" INTEGER NOT NULL,
	"updated_at" INTEGER NOT NULL
)`;
}

/** Fields in display order. */
const fieldOrder = [asc(fields.position), asc(fields.createdAt)];

/**
 * Collections: a row in the system database and a table in the app database (created with the
 * first field, see `FieldsService`). The schema API over them is `SchemaService`.
 */
export class CollectionsService extends Service {
	list(): ResultAsync<Collection[], ServiceError<6000, 'COLLECTIONS_FAILED'>> {
		return this.run(
			() => this.db.select().from(collections).orderBy(asc(collections.name)),
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/** Every collection with its fields (in position order), read in one round-trip. */
	listWithFields(): ResultAsync<
		{ collection: Collection; fields: Field[] }[],
		ServiceError<6000, 'COLLECTIONS_FAILED'>
	> {
		return this.run(
			async () => {
				const [all, allFields] = await this.db.batch([
					this.db.select().from(collections).orderBy(asc(collections.name)),
					this.db
						.select()
						.from(fields)
						.orderBy(...fieldOrder)
				]);

				return all.map((collection) => ({
					collection,
					fields: allFields.filter((field) => field.collectionId === collection.id)
				}));
			},
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	getByName(
		name: string
	): ResultAsync<Collection | null, ServiceError<6000, 'COLLECTIONS_FAILED'>> {
		return this.run(
			async () => (await this.find(name)) ?? null,
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	getById(id: string): ResultAsync<Collection | null, ServiceError<6000, 'COLLECTIONS_FAILED'>> {
		return this.run(
			async () => {
				const [collection] = await this.db.select().from(collections).where(eq(collections.id, id));

				return collection ?? null;
			},
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/** The collection with this name; an error when it doesn't exist. */
	requireByName(name: string): ResultAsync<Collection, CollectionLookupError> {
		return this.run(
			async () => (await this.find(name)) ?? this.fail(6006, 'COLLECTION_NOT_FOUND'),
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/**
	 * The collection with this name and its fields (in position order), read in one round-trip; an
	 * error when it doesn't exist.
	 */
	requireWithFields(
		name: string
	): ResultAsync<{ collection: Collection; fields: Field[] }, CollectionLookupError> {
		return this.run(
			async () => {
				const [[collection], collectionFields] = await this.db.batch([
					this.db.select().from(collections).where(eq(collections.name, name)),
					this.db
						.select()
						.from(fields)
						.where(
							inArray(
								fields.collectionId,
								this.db
									.select({ id: collections.id })
									.from(collections)
									.where(eq(collections.name, name))
							)
						)
						.orderBy(...fieldOrder)
				]);

				if (!collection) {
					this.fail(6006, 'COLLECTION_NOT_FOUND');
				}

				return { collection, fields: collectionFields };
			},
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/**
	 * Registers a collection without fields. SQLite tables need at least one column, so its table is
	 * created in the app database together with the first field (see `FieldsService.create`).
	 *
	 * @param id A publish keeps the id the collection has on the development instance.
	 */
	create(name: string, id?: string): ResultAsync<Collection, CollectionsError> {
		return this.run(
			async () => {
				await this.requireNameAvailable(name);

				const [collection] = await this.db.insert(collections).values({ id, name }).returning();

				return collection;
			},
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/** Renames the table in the app database and the collection in the system database. */
	rename(name: string, newName: string): ResultAsync<Collection, CollectionsError> {
		return this.run(
			async () => {
				if (!isValidCollectionName(newName)) {
					this.fail(6002, 'INVALID_COLLECTION_NAME');
				}

				const collection = await this.require(name);

				if (collection.system) {
					this.fail(6011, 'SYSTEM_COLLECTION');
				}

				if (newName === collection.name) {
					return collection;
				}

				await this.requireNameAvailable(newName);

				const { id: databaseId } = await this.must(this.services.database().requireApp());

				// A collection without fields has no table yet.
				if (await tableExists(databaseId, collection.name)) {
					await queryDatabase(
						databaseId,
						`ALTER TABLE "${collection.name}" RENAME TO "${newName}"`
					);
				}

				const [renamed] = await this.db
					.update(collections)
					.set({ name: newName })
					.where(eq(collections.id, collection.id))
					.returning();

				return renamed;
			},
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/**
	 * Drops the table, including all its records, and removes the collection. Refused while
	 * relation fields of other collections point to it.
	 */
	delete(name: string): ResultAsync<void, CollectionsError> {
		return this.run(
			async () => {
				const collection = await this.require(name);

				if (collection.system) {
					this.fail(6011, 'SYSTEM_COLLECTION');
				}

				const [reference] = await this.db
					.select({ id: fields.id })
					.from(fields)
					.where(
						and(
							eq(fields.type, 'relation'),
							ne(fields.collectionId, collection.id),
							sql`json_extract(${fields.options}, '$.collectionId') = ${collection.id}`
						)
					)
					.limit(1);

				if (reference) {
					this.fail(6009, 'COLLECTION_IN_USE');
				}

				const { id: databaseId } = await this.must(this.services.database().requireApp());

				await queryDatabase(databaseId, `DROP TABLE IF EXISTS "${collection.name}"`);
				await this.db.delete(collections).where(eq(collections.id, collection.id));
			},
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/**
	 * Creates a built-in collection with its system fields, or brings an existing one up to date:
	 * marks it (and those fields, plus its default fields) as system and adds missing fields. Used
	 * for `users` and `files`.
	 */
	ensureSystem(
		name: string,
		systemFields: CreateFieldInput[]
	): ResultAsync<Collection, CollectionsError> {
		return this.run(
			async () => {
				let collection = (await this.find(name)) ?? (await this.createBuiltIn(name));

				if (!collection.system) {
					await this.db
						.update(collections)
						.set({ system: true })
						.where(eq(collections.id, collection.id));
					collection = { ...collection, system: true };
				}

				const existing = await this.must(this.services.fields().list(collection.id));
				// The default fields come with the table; they can't be added afterwards.
				const defaults = BUILT_IN_DEFAULT_FIELDS.map((field) => ({
					...field,
					required: false,
					unique: false
				}));

				for (const field of [...defaults, ...systemFields]) {
					const current = existing.find((candidate) => candidate.name === field.name);

					if (!current && isAutoType(field.type)) {
						continue;
					}

					if (!current) {
						await this.must(this.services.fields().create(name, { ...field, system: true }));
					} else if (!current.system) {
						await this.db.update(fields).set({ system: true }).where(eq(fields.id, current.id));
					}
				}

				return collection;
			},
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/** Settings of a collection, e.g. thumbnail sizes of `files`. */
	getSettings(name: string): ResultAsync<CollectionSettings, CollectionLookupError> {
		return this.requireByName(name).map((collection) => collection.settings ?? {});
	}

	/** Replaces the given sections of a collection's settings; other sections are kept. */
	updateSettings(
		name: string,
		changes: Partial<CollectionSettings>
	): ResultAsync<CollectionSettings, CollectionLookupError> {
		return this.run(
			async () => {
				const collection = await this.require(name);
				const settings: CollectionSettings = { ...(collection.settings ?? {}), ...changes };

				await this.db
					.update(collections)
					.set({ settings })
					.where(eq(collections.id, collection.id));

				return settings;
			},
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/**
	 * Replaces the API rules of a collection. Every rule is compiled against the collection's
	 * fields first; invalid rules come back as issues keyed by action.
	 */
	updateRules(name: string, rules: ApiRules): ResultAsync<ApiRules, CollectionsError> {
		return this.run(
			async () => {
				const { collection, fields: collectionFields } = await this.must(
					this.requireWithFields(name)
				);
				const relations = await this.must(
					this.services.records().filterRelations(Object.values(rules))
				);
				const issues: Record<string, string> = {};
				const readable = collectionFields.filter((field) => field.type !== 'blob');
				const saved: ApiRules = {};

				for (const action of apiActions(collection)) {
					const rule = rules[action] ?? null;

					try {
						// Compiled as a signed-in request, so every part of the rule is checked.
						compileRule(rule, readable, { user: {}, input: {}, table: collection.name, relations });
						saved[action] = rule === null ? null : rule.trim();
					} catch (error) {
						issues[action] = error instanceof Error ? error.message : 'Invalid rule';
					}
				}

				if (Object.keys(issues).length) {
					this.fail(6014, 'INVALID_API_RULES', { data: { issues } });
				}

				await this.must(this.updateSettings(name, { rules: saved }));

				return saved;
			},
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/** The collection with this name, or `undefined`. Throws on database errors. */
	private async find(name: string) {
		const [collection] = await this.db.select().from(collections).where(eq(collections.name, name));

		return collection;
	}

	/** The collection with this name, or `COLLECTION_NOT_FOUND`. */
	private async require(name: string) {
		return (await this.find(name)) ?? this.fail(6006, 'COLLECTION_NOT_FOUND');
	}

	/** Fails when the name is invalid or taken; names end up in SQL as table names. */
	private async requireNameAvailable(name: string) {
		if (!isValidCollectionName(name)) {
			this.fail(6002, 'INVALID_COLLECTION_NAME');
		}

		if (await this.find(name)) {
			this.fail(6003, 'COLLECTION_ALREADY_EXISTS');
		}
	}

	/** Creates a built-in collection with its table and `BUILT_IN_DEFAULT_FIELDS`. */
	private async createBuiltIn(name: string) {
		await this.requireNameAvailable(name);

		const { id: databaseId } = await this.must(this.services.database().requireApp());

		await queryDatabase(databaseId, createTableSql(name));

		const [collection] = await this.db.insert(collections).values({ name }).returning();

		await this.db.insert(fields).values(
			BUILT_IN_DEFAULT_FIELDS.map((field, position) => ({
				collectionId: collection.id,
				name: field.name,
				type: field.type,
				options: field.options,
				position
			}))
		);

		return collection;
	}
}
