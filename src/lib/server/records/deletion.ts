import type { RelationOnDelete } from '#lib/fields/field-types.js';
import type { Field } from '../services/fields.service';
import type { RecordContext } from './values';

import { eq } from 'drizzle-orm';

import { FILES_COLLECTION } from '#lib/files/files.js';
import { relationOnDelete } from '#lib/fields/field-types.js';

import { batchDatabase, chunks } from '../db/query';
import { collections, db, fields } from '../db';
import { parseThumbnailList, storageKeys } from '../services/files.service';
import { autoFields, keyParams, MAX_IDS, placeholders, returning } from './values';

/**
 * What deleting records does to the records that link to them. Relation fields follow their
 * `onDelete` option (see `RELATION_ON_DELETE`): they are unlinked, the records that link are
 * deleted too, or nothing is deleted while a record links to them.
 */

/** Most records one delete may cascade to through relation fields. */
const MAX_CASCADE = 1000;

/** A relation field, the name of the collection it belongs to, and what deleting does to it. */
export type Relation = { collection: string; field: Field; onDelete: RelationOnDelete };

/**
 * What a delete does (see `deletionPlan()`): the records to delete per collection name (those
 * requested and those it cascades to), and the relation fields to unlink the deleted ids from.
 */
export type DeletionPlan = {
	deletes: Map<string, { context: RecordContext; ids: Set<string> }>;
	unlinks: { context: RecordContext; field: Field; ids: string[] }[];
};

/** A record can't be deleted: a record of `collection` links to it through a restricting `field`. */
export class RecordInUseFailure extends Error {
	constructor(
		readonly collection: string,
		readonly field: string
	) {
		super(`A record of ${collection} links to it through ${field}`);
	}
}

/** A record can't be deleted: it is the default value of relation `field` of `collection`. */
export class RecordIsDefaultFailure extends Error {
	constructor(
		readonly collection: string,
		readonly field: string
	) {
		super(`The record is the default value of ${collection}.${field}`);
	}
}

/** Deleting would cascade to more records than `MAX_CASCADE`. */
export class CascadeTooLargeFailure extends Error {}

/** Every relation field of every collection, to follow when records are deleted. */
export async function allRelations(): Promise<Relation[]> {
	const rows = await db
		.select({ field: fields, collection: collections.name })
		.from(fields)
		.innerJoin(collections, eq(collections.id, fields.collectionId))
		.where(eq(fields.type, 'relation'));

	return rows.map(({ field, collection }) => ({
		collection,
		field,
		onDelete: relationOnDelete(field.options)
	}));
}

/** Whether the relation field links to the collection with this id. */
export function linksTo(relation: Relation, collectionId: string) {
	return relation.field.options.collectionId === collectionId;
}

/**
 * The keys of the records of `source` whose relation `field` links to one of `ids`. Ids are
 * compared as text: a relation stores them as text, also those of auto-increment ids.
 */
export function linkedSelect(source: RecordContext, field: Field, ids: string[]) {
	const table = `"${source.collection.name}"`;
	const key = `${table}."${autoFields(source.fields).key}"`;

	return {
		sql: field.options.multiple
			? `SELECT DISTINCT ${key} FROM ${table}, json_each(${table}."${field.name}") AS "item" WHERE CAST("item"."value" AS TEXT) IN (${placeholders(ids)})`
			: `SELECT ${key} FROM ${table} WHERE "${field.name}" IN (${placeholders(ids)})`,
		params: ids
	};
}

/**
 * Removes `ids` from relation `field` of the records of `source`: a single relation becomes empty,
 * a multiple one loses them (and becomes empty without any left). Returns the changed rows.
 */
export function unlinkStatement(source: RecordContext, field: Field, ids: string[]) {
	const table = `"${source.collection.name}"`;
	const column = `${table}."${field.name}"`;
	const key = autoFields(source.fields).key;

	return field.options.multiple
		? {
				sql: `UPDATE ${table} SET "${field.name}" = (SELECT CASE WHEN count(*) THEN json_group_array("value") END FROM json_each(${column}) WHERE CAST("value" AS TEXT) NOT IN (${placeholders(ids)})) WHERE EXISTS (SELECT 1 FROM json_each(${column}) WHERE CAST("value" AS TEXT) IN (${placeholders(ids)})) RETURNING ${returning(key, source.fields)}`,
				params: [...ids, ...ids]
			}
		: {
				sql: `UPDATE ${table} SET "${field.name}" = NULL WHERE "${field.name}" IN (${placeholders(ids)}) RETURNING ${returning(key, source.fields)}`,
				params: ids
			};
}

/**
 * What deleting `ids` of the collection of `root` does through the relation fields that link
 * to it, followed from collection to collection for cascades. Throws a `RecordInUseFailure`
 * when a record that stays links to a deleted one through a restricting field, a
 * `RecordIsDefaultFailure` when a deleted record is a relation's default value, and a
 * `CascadeTooLargeFailure` beyond `MAX_CASCADE` records.
 *
 * @param contextOf - Reads the context of a collection by name (throws when it can't).
 */
export async function deletionPlan(
	root: RecordContext,
	ids: string[],
	relations: Relation[],
	contextOf: (name: string) => Promise<RecordContext>
): Promise<DeletionPlan> {
	const { databaseId } = root;
	const contexts = new Map([[root.collection.name, root]]);
	const deletes: DeletionPlan['deletes'] = new Map([
		[root.collection.name, { context: root, ids: new Set(ids) }]
	]);
	const unlinks: DeletionPlan['unlinks'] = [];
	const restricts: DeletionPlan['unlinks'] = [];
	const queue = [{ context: root, ids }];
	let total = ids.length;

	const known = async (name: string) => {
		let context = contexts.get(name);

		if (!context) {
			context = await contextOf(name);
			contexts.set(name, context);
		}

		return context;
	};

	const linked = async (source: RecordContext, field: Field, targetIds: string[]) => {
		const results = await batchDatabase(
			databaseId,
			chunks(targetIds, MAX_IDS).map((chunk) => linkedSelect(source, field, chunk))
		);

		return [...new Set(results.flat().map(([id]) => String(id)))];
	};

	for (let next = queue.shift(); next; next = queue.shift()) {
		const target = next;

		for (const relation of relations.filter((candidate) =>
			linksTo(candidate, target.context.collection.id)
		)) {
			const source = await known(relation.collection);

			if (relation.onDelete !== 'cascade') {
				(relation.onDelete === 'restrict' ? restricts : unlinks).push({
					context: source,
					field: relation.field,
					ids: target.ids
				});
				continue;
			}

			const entry = deletes.get(source.collection.name) ?? {
				context: source,
				ids: new Set<string>()
			};
			const added = (await linked(source, relation.field, target.ids)).filter(
				(id) => !entry.ids.has(id)
			);

			if (!added.length) {
				continue;
			}

			total += added.length;

			if (total > MAX_CASCADE) {
				throw new CascadeTooLargeFailure();
			}

			added.forEach((id) => entry.ids.add(id));
			deletes.set(source.collection.name, entry);
			queue.push({ context: source, ids: added });
		}
	}

	// New records would link to a deleted default value.
	for (const relation of relations) {
		const defaultValue = relation.field.defaultValue;
		const target = [...deletes.values()].find((entry) =>
			linksTo(relation, entry.context.collection.id)
		);

		if (defaultValue && target?.ids.has(defaultValue)) {
			throw new RecordIsDefaultFailure(relation.collection, relation.field.name);
		}
	}

	// Checked once every cascade is known: records that are deleted too don't hold it back.
	for (const restrict of restricts) {
		const doomed = deletes.get(restrict.context.collection.name)?.ids;
		const holding = (await linked(restrict.context, restrict.field, restrict.ids)).find(
			(id) => !doomed?.has(id)
		);

		if (holding) {
			throw new RecordInUseFailure(restrict.context.collection.name, restrict.field.name);
		}
	}

	return { deletes, unlinks };
}

/**
 * The stored files of these records when the collection is the built-in `files`, to remove
 * from storage once they are deleted (see `storageKeysOf()`).
 */
export async function storedFiles({ collection, databaseId }: RecordContext, ids: string[]) {
	if (!ids.length || !collection.system || collection.name !== FILES_COLLECTION) {
		return [];
	}

	const results = await batchDatabase(
		databaseId,
		chunks(ids, MAX_IDS).map((chunk) => ({
			sql: `SELECT "id", "key", "thumbnails" FROM "files" WHERE "id" IN (${placeholders(chunk)})`,
			params: chunk
		}))
	);

	return results.flat();
}

/** The storage keys (the original and every thumbnail) of the stored files that were deleted. */
export function storageKeysOf(stored: unknown[][], deleted: string[]) {
	return stored
		.filter(([id]) => deleted.includes(String(id)))
		.flatMap(([, key, thumbnails]) =>
			storageKeys({ key: String(key), thumbnails: parseThumbnailList(thumbnails) })
		);
}

/** The statements that remove the linked provider accounts and passwords of deleted users. */
export function userCleanupStatements(deleted: string[]) {
	return chunks(deleted, MAX_IDS).flatMap((chunk) => [
		{
			sql: `DELETE FROM "_external_auths" WHERE "user_id" IN (${placeholders(chunk)})`,
			params: chunk
		},
		{ sql: `DELETE FROM "_passwords" WHERE "user_id" IN (${placeholders(chunk)})`, params: chunk }
	]);
}

/**
 * Runs a deletion plan in one batch: the unlinks first, then the deletes of every collection,
 * in statements of at most `MAX_IDS` parameters. Returns the changed rows per unlink and the
 * deleted rows (see `returning()`) per collection of the plan.
 */
export async function executeDeletion(databaseId: string, plan: DeletionPlan) {
	const deletes = [...plan.deletes.values()];
	// Unlinking repeats the ids in its statement, so it takes half as many.
	const unlinks = plan.unlinks.flatMap((unlink) =>
		chunks(unlink.ids, Math.floor(MAX_IDS / 2)).map((chunk) => ({
			context: unlink.context,
			statement: unlinkStatement(unlink.context, unlink.field, chunk)
		}))
	);
	const removals = deletes.flatMap((entry) => {
		const key = autoFields(entry.context.fields).key;

		return chunks<string | number>(keyParams(key, [...entry.ids]), MAX_IDS).map((chunk) => ({
			entry,
			statement: {
				sql: `DELETE FROM "${entry.context.collection.name}" WHERE "${key}" IN (${placeholders(chunk)}) RETURNING ${returning(key, entry.context.fields)}`,
				params: chunk
			}
		}));
	});
	const results = await batchDatabase(databaseId, [
		...unlinks.map(({ statement }) => statement),
		...removals.map(({ statement }) => statement)
	]);

	return {
		unlinked: unlinks.map((unlink, index) => ({ context: unlink.context, rows: results[index] })),
		deleted: deletes.map((entry) => ({
			context: entry.context,
			rows: removals.flatMap((removal, index) =>
				removal.entry === entry ? results[unlinks.length + index] : []
			)
		}))
	};
}
