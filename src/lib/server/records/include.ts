import type { SqlCondition } from '../filter';
import type { Field } from '../services/fields.service';
import type { PluginsService } from '../services/plugins.service';
import type { ApiAccess } from './access';
import type { IncludeTree } from './query';
import type { RulesHost } from './rules';
import type { ApiRecord, RecordContext } from './values';

import { isMultiple } from '#lib/fields/field-types.js';

import { batchDatabase } from '../db/query';
import { chunks } from '../db/query';
import { Failure, unwrap } from '../failure';
import { visibleFields } from './access';
import { deserialize } from './plugin-values';
import { includeTree, relatedIds } from './query';
import { guard, queryParam } from './rules';
import { autoFields, MAX_IDS, placeholders, toApiRecord } from './values';

/**
 * `?include=`: replacing relation fields by the records they point to, level by level. What it
 * needs from the records service (its context and rule checks) comes in as the `host`.
 */

export type IncludeHost = RulesHost & { plugins: PluginsService };

/**
 * Replaces the relation fields in `tree` of `records` (of a collection with `collectionFields`)
 * by the records they point to, as the API returns them, and expands those in turn. A single
 * relation becomes a record or `null`, a multiple one an array of records. With `access`, only
 * related records that the view rule of their collection matches are included; fails when the
 * API doesn't show records of that collection at all. Without records, every level is still
 * checked.
 */
export async function includeRelated(
	host: IncludeHost,
	collectionFields: Field[],
	records: ApiRecord[],
	tree: IncludeTree,
	access: ApiAccess | undefined
): Promise<void> {
	await Promise.all(
		[...tree].map(async ([name, subtree]) => {
			const field = collectionFields.find((field) => field.name === name)!;
			const target = await unwrap(host.collections.getById(field.options.collectionId ?? ''));
			const related = target
				? await relatedRecords(
						host,
						await host.context(target.name),
						records,
						name,
						subtree,
						access
					)
				: new Map<string, ApiRecord>();

			for (const record of records) {
				const found = relatedIds(record[name]).flatMap((id) => related.get(id) ?? []);

				record[name] = isMultiple(field) ? found : (found[0] ?? null);
			}
		})
	);
}

/**
 * The records of `context` that field `name` of `records` points to, by id and expanded by
 * `subtree`: only those its view rule lets `access` see.
 */
async function relatedRecords(
	host: IncludeHost,
	context: RecordContext,
	records: ApiRecord[],
	name: string,
	subtree: IncludeTree,
	access: ApiAccess | undefined
): Promise<Map<string, ApiRecord>> {
	const { collection, fields: collectionFields, databaseId } = context;
	const readable = visibleFields(collectionFields, access);
	const { id: idColumn } = autoFields(collectionFields);
	const ids = [...new Set(records.flatMap((record) => relatedIds(record[name])))];
	let rule: SqlCondition;

	try {
		rule = await guard(host, context, 'view', access);
	} catch (error) {
		if (error instanceof Failure && (error.error.code === 8013 || error.error.code === 8014)) {
			throw new Failure({
				code: 8015,
				message: 'INVALID_QUERY',
				data: {
					param: 'include',
					message: `the API doesn't show records of \`${collection.name}\`, so \`${name}\` can't be included`
				}
			});
		}

		throw error;
	}

	queryParam('include', () => includeTree(readable, subtree));

	if (!idColumn || !ids.length) {
		await includeRelated(host, collectionFields, [], subtree, access);

		return new Map();
	}

	// Every statement binds the rule's parameters as well as the ids.
	const size = Math.max(MAX_IDS - rule.params.length, 1);
	const columns = readable.map((field) => `"${field.name}"`).join(', ');
	const results = await batchDatabase(
		databaseId,
		chunks(ids, size).map((chunk) => ({
			sql: `SELECT ${columns} FROM "${collection.name}" WHERE "${idColumn}" IN (${placeholders(chunk)}) AND (${rule.sql})`,
			params: [...chunk, ...rule.params]
		}))
	);
	const found = results.flat().map((row) => toApiRecord(readable, row));

	await deserialize(host.plugins, collectionFields, found);
	await includeRelated(host, collectionFields, found, subtree, access);

	return new Map(found.map((record) => [String(record[idColumn]), record]));
}
