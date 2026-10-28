import type { Collection } from '../services/collections.service';
import type { Field } from '../services/fields.service';
import type { RecordRow } from './values';

import { asc, inArray } from 'drizzle-orm';

import { isRelationType } from '#lib/fields/field-types.js';

import { batchDatabase } from '../db/query';
import { collections, db, fields } from '../db';
import { chunks, MAX_IDS, parseIds, placeholders } from './values';

/**
 * The collections that relation fields point to, and the labels the grid shows for related
 * records. Throws on database errors.
 */

/**
 * The collection a relation field points to, the field used as the label of its records, and
 * its `id` and first `created` field. Without an `id` field its records can't be linked.
 */
export type RelationTarget = {
	collection: Collection;
	label: string | null;
	id: string | null;
	created: string | null;
};

/** Field types whose value makes a good label for a related record, in order of preference. */
const LABEL_TYPES = new Set(['text', 'email', 'url']);

/**
 * The related collections and their label fields, by collection id, read in one round-trip.
 * Collections that don't exist are left out.
 */
export async function relationTargets(collectionIds: string[]) {
	const targets = new Map<string, RelationTarget>();
	const ids = [...new Set(collectionIds)];

	if (!ids.length) {
		return targets;
	}

	const [targetCollections, targetFields] = await db.batch([
		db.select().from(collections).where(inArray(collections.id, ids)),
		db
			.select({ collectionId: fields.collectionId, name: fields.name, type: fields.type })
			.from(fields)
			.where(inArray(fields.collectionId, ids))
			.orderBy(asc(fields.position), asc(fields.createdAt))
	]);

	for (const collection of targetCollections) {
		const own = targetFields.filter((field) => field.collectionId === collection.id);
		const named = (match: (type: Field['type']) => boolean) =>
			own.find((field) => match(field.type))?.name ?? null;

		targets.set(collection.id, {
			collection,
			label: named((type) => LABEL_TYPES.has(type)),
			id: named((type) => type === 'id'),
			created: named((type) => type === 'created')
		});
	}

	return targets;
}

/** The related collection of a relation field and the field used as its label, or `null`. */
export async function relationTarget(collectionId: string | undefined) {
	return collectionId ? ((await relationTargets([collectionId])).get(collectionId) ?? null) : null;
}

/** The targets of the relation fields among `collectionFields`. */
export function relationTargetsOf(collectionFields: Field[]) {
	return relationTargets(
		collectionFields
			.filter((field) => isRelationType(field.type) && field.options.collectionId)
			.map((field) => field.options.collectionId!)
	);
}

/**
 * Replaces relation ids in the rows with `{ id, label }` references, in place, and returns the
 * name of the collection each relation field points to, by field name. Fields are resolved in
 * parallel.
 */
export async function resolveRelations(
	databaseId: string,
	collectionFields: Field[],
	rows: RecordRow[],
	targets: Map<string, RelationTarget>
) {
	const names: Record<string, string> = {};
	const relationFields = collectionFields.filter((field) => isRelationType(field.type));

	await Promise.all(
		relationFields.map(async (field) => {
			const idsByRow = rows.map((row) => {
				try {
					return parseIds(row[field.name]);
				} catch {
					return [];
				}
			});
			const ids = [...new Set(idsByRow.flat())];
			const labels = new Map<string, string>();
			const target = targets.get(field.options.collectionId ?? '');

			if (target) {
				names[field.name] = target.collection.name;
			}

			if (target?.id && ids.length) {
				const { id: idColumn, label } = target;
				const results = await batchDatabase(
					databaseId,
					chunks(ids, MAX_IDS).map((chunk) => ({
						sql: `SELECT "${idColumn}", "${label ?? idColumn}" FROM "${target.collection.name}" WHERE "${idColumn}" IN (${placeholders(chunk)})`,
						params: chunk
					}))
				);

				for (const [id, label] of results.flat()) {
					labels.set(String(id), String(label ?? id));
				}
			}

			rows.forEach((row, index) => {
				row[field.name] = idsByRow[index].map((id) => ({ id, label: labels.get(id) ?? id }));
			});
		})
	);

	return names;
}
