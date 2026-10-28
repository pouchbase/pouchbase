import type { ManifestIssue, PluginManifest } from '@pouchbasejs/plugin-sdk';
import type { ApiUpdateCollection } from '#lib/schemas/collections.js';
import type { SnapshotCollection } from '#lib/schemas/environments.js';
import type { ResultAsync } from 'neverthrow';
import type { AnyServiceError } from '../services/base.service';
import type { Services } from '../services/services';

import { pluginCollectionName } from '@pouchbasejs/plugin-sdk';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';

import { apiCreateCollectionSchema } from '#lib/schemas/collections.js';

import { collections, db, fields } from '../db';
import { collectionFields, collectionIndexes, collectionKeyField } from './collections';
import { fail } from './errors';

/**
 * Creating, updating and deleting the collections a plugin contributes
 * (`contributes.collections`, named `<plugin>_<name>` and owned by the plugin), through the schema
 * API. `collections.ts` turns the manifest into what that API takes; this runs it.
 */

type Named = { contribution: PluginManifest['contributes']['collections'][number]; name: string };

/** The value of another service's result; its error fails with `PLUGINS_FAILED`. */
async function unwrap<T>(result: ResultAsync<T, AnyServiceError>): Promise<T> {
	const settled = await result;

	if (settled.isErr()) {
		fail({ code: 19001, message: 'PLUGINS_FAILED' }, settled.error);
	}

	return settled.value;
}

function invalid(issues: ManifestIssue[]): never {
	return fail({ code: 19021, message: 'INVALID_PLUGIN_COLLECTION', data: { issues } });
}

/** The collection as the schema API takes it, or its issues. */
function collectionInput(
	manifest: PluginManifest,
	{ contribution, name }: Named,
	ids: ReadonlyMap<string, string>,
	current: SnapshotCollection | null
) {
	const result = collectionFields(manifest, contribution, ids, current);

	if ('issue' in result) {
		return { issues: [result.issue] };
	}

	const parsed = apiCreateCollectionSchema.safeParse({
		name,
		fields: result.fields,
		indexes: collectionIndexes(contribution, current),
		rules: contribution.rules
	});

	return parsed.success
		? { collection: parsed.data }
		: {
				issues: parsed.error.issues.map((issue) => ({
					path: `contributes.collections.${contribution.name}.${issue.path.join('.')}`,
					message: issue.message
				}))
			};
}

/** A collection with only its key field, as the schema API takes it. */
function keyOnly({ contribution, name }: Named) {
	const parsed = apiCreateCollectionSchema.safeParse({
		name,
		fields: [collectionKeyField(contribution)],
		indexes: [],
		rules: {}
	});

	if (!parsed.success) {
		fail({ code: 19001, message: 'PLUGINS_FAILED' }, parsed.error);
	}

	return parsed.data;
}

/**
 * Creates the collections the plugin contributes and brings existing ones in line with the
 * manifest. Fields and indexes the manifest leaves out stay, so an update never loses data; a
 * change the schema API counts as destructive fails. Everything is checked before anything
 * changes: a collection with one of the names that isn't the plugin's fails with
 * `PLUGIN_COLLECTION_TAKEN`, an invalid one with `INVALID_PLUGIN_COLLECTION`.
 */
export async function applyCollections(services: Services, manifest: PluginManifest) {
	const contributions = manifest.contributes.collections;

	if (!contributions.length) {
		return;
	}

	const schema = services.schema();
	const named: Named[] = contributions.map((contribution) => ({
		contribution,
		name: pluginCollectionName(manifest.id, contribution.name)
	}));
	/** The collections and their schemas, read at the same time. */
	const read = async () => {
		const [existing, current] = await Promise.all([
			unwrap(services.collections().list()),
			unwrap(schema.schemas())
		]);

		return { existing, current };
	};

	let { existing, current } = await read();
	const byName = new Map(existing.map((collection) => [collection.name, collection]));
	const taken = named.find(({ name }) => {
		const collection = byName.get(name);

		return collection && collection.pluginId !== manifest.id;
	});

	if (taken) {
		fail({ code: 19020, message: 'PLUGIN_COLLECTION_TAKEN', data: { name: taken.name } });
	}

	// Checked with stand-in ids for the collections that don't exist yet.
	const planned = new Map(existing.map((collection) => [collection.name, collection.id]));

	for (const { name } of named) {
		if (!planned.has(name)) {
			planned.set(name, `new-${name}`);
		}
	}

	const issues = named.flatMap(
		(item) => collectionInput(manifest, item, planned, null).issues ?? []
	);

	if (issues.length) {
		invalid(issues);
	}

	// Every collection has its key field before the rest, so relations between them find each
	// other's ids, and a relation's target has the `id` field it needs, whatever the order: new
	// collections are created with it, and one left without fields by an install that failed gets
	// it.
	const missing = named.filter(({ name }) => !byName.has(name));
	const keyless = named.filter(
		({ name }) =>
			byName.has(name) &&
			!current
				.find((collection) => collection.name === name)
				?.fields.some((field) => field.type === 'id')
	);

	for (const item of missing) {
		await unwrap(schema.create(keyOnly(item)));
		await db
			.update(collections)
			.set({ pluginId: manifest.id })
			.where(eq(collections.name, item.name));
	}

	if (keyless.length) {
		await unwrap(
			schema.updateMany(
				keyless.map((item) => ({ name: item.name, input: { fields: keyOnly(item).fields } })),
				false
			)
		);
	}

	if (missing.length || keyless.length) {
		({ existing, current } = await read());
	}

	// One plan for all of them, on one read of the schema; an update that changes nothing writes
	// nothing.
	const ids = new Map(existing.map((collection) => [collection.name, collection.id]));
	const items: { name: string; input: ApiUpdateCollection }[] = [];

	for (const item of named) {
		const snapshot = current.find((collection) => collection.name === item.name) ?? null;
		const result = collectionInput(manifest, item, ids, snapshot);

		if (!result.collection) {
			invalid(result.issues ?? []);
		}

		const { fields: inputFields, indexes, rules } = result.collection;

		items.push({ name: item.name, input: { fields: inputFields, indexes, rules } });
	}

	await unwrap(schema.updateMany(items, false));
}

/**
 * Deletes the plugin's collections with their records. Checks first that no relation field of
 * another collection points to one of them (`PLUGIN_COLLECTION_IN_USE`); relations between them
 * are no obstacle, as each round deletes those nothing points to anymore.
 */
export async function deleteCollections(services: Services, pluginId: string) {
	const own = await db
		.select({ id: collections.id, name: collections.name })
		.from(collections)
		.where(eq(collections.pluginId, pluginId));

	if (!own.length) {
		return;
	}

	const ids = own.map((collection) => collection.id);
	const [reference] = await db
		.select({
			collection: collections.name,
			field: fields.name,
			target: sql<string>`json_extract(${fields.options}, '$.collectionId')`
		})
		.from(fields)
		.innerJoin(collections, eq(fields.collectionId, collections.id))
		.where(
			and(
				eq(fields.type, 'relation'),
				notInArray(fields.collectionId, ids),
				inArray(sql`json_extract(${fields.options}, '$.collectionId')`, ids)
			)
		)
		.limit(1);

	if (reference) {
		fail({
			code: 19023,
			message: 'PLUGIN_COLLECTION_IN_USE',
			data: {
				collection: reference.collection,
				field: reference.field,
				target: own.find((item) => item.id === reference.target)?.name ?? reference.target
			}
		});
	}

	const service = services.collections();
	let pending = own.map((collection) => collection.name);

	while (pending.length) {
		const left: string[] = [];

		for (const name of pending) {
			const result = await service.delete(name);

			// Another of the plugin's collections still points to it: the next round.
			if (result.isErr() && result.error.code === 6009) {
				left.push(name);
			} else if (result.isErr() && result.error.code !== 6006) {
				fail({ code: 19001, message: 'PLUGINS_FAILED' }, result.error);
			}
		}

		if (left.length === pending.length) {
			throw new Error(`The collections ${left.join(', ')} point to each other`);
		}

		pending = left;
	}
}
