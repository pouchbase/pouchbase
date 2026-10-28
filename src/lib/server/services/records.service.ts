import type { ResultAsync } from 'neverthrow';
import type { SignInMethod } from '#lib/auth/sign-in-methods.js';
import type { FieldOptions } from '#lib/fields/field-types.js';
import type { ApiRuleAction } from '#lib/filter/rules.js';
import type { RealtimeAction } from '#lib/realtime/protocol.js';
import type { FilterContext } from '../filter';
import type { ApiAccess } from '../records/access';
import type { IncludeHost } from '../records/include';
import type { ApiQuery, ApiQueryParam } from '../records/rules';
import type { ComputedPreview } from '../records/write';
import type {
	ApiRecord,
	RecordContext,
	RecordInput,
	RecordIssues,
	RecordRow,
	RelationRef,
	StoredValue
} from '../records/values';
import type { CollectionLookupError } from './collections.service';
import type { Field } from './fields.service';
import type { ContextError, ServiceError } from './base.service';

import { USERS_COLLECTION } from '#lib/auth/users.js';
import { NOW_DEFAULT } from '#lib/fields/field-types.js';
import { fileFieldRules } from '#lib/files/accept.js';
import { FILES_COLLECTION } from '#lib/files/files.js';

import { computedSpecs, fillComputedColumns } from '../computed';
import { batchDatabase, queryDatabase, uniqueViolation } from '../db/query';
import { reasonOf } from '../errors';
import { ALWAYS } from '../filter';
import { generateId } from '../crypto';
import { inBackground } from '../platform/runtime';
import { visibleFields } from '../records/access';
import {
	allRelations,
	CascadeTooLargeFailure,
	deletionPlan,
	executeDeletion,
	linksTo,
	RecordInUseFailure,
	RecordIsDefaultFailure,
	storageKeysOf,
	storedFiles,
	userCleanupStatements
} from '../records/deletion';
import { readGrid } from '../records/grid';
import { deserialize } from '../records/plugin-values';
import { includeRelated } from '../records/include';
import { includeTree, selectFields, withIncluded } from '../records/query';
import { relationTarget } from '../records/relations';
import { compileQuery, filterRelations, guard, queryParam } from '../records/rules';
import {
	apiFields,
	autoFields,
	keyParams,
	readableColumns,
	MAX_IDS,
	placeholders,
	returning,
	toApiRecord
} from '../records/values';
import {
	computeValues,
	fillSqlDefaults,
	previewComputed,
	readStoredRecord,
	validateInput
} from '../records/write';
import { Service } from './base.service';

export type { ApiAccess } from '../records/access';
export type {
	ApiRecord,
	RecordInput,
	RecordIssues,
	RecordRow,
	RecordValue,
	RelationRef
} from '../records/values';

export type ListRecordsOptions = {
	page: number;
	perPage: number;
	sort?: string;
	order?: 'asc' | 'desc';
};

export type RecordPage = {
	fields: Field[];
	items: RecordRow[];
	total: number;
	page: number;
	perPage: number;
	sort: string;
	order: 'asc' | 'desc';
	/** Name of the collection each relation field points to, keyed by field name. */
	relationTargets: Record<string, string>;
	/** Only for the built-in `users` collection: how each user on this page can sign in. */
	signInMethods?: Record<string, SignInMethod[]>;
};

export type ApiListOptions = {
	/** Records to return. */
	limit: number;
	/** Matching records to skip first. */
	offset: number;
	/** Fields to order by: `created_at:desc,title` (`:asc` when left out). */
	order?: string;
	/** A condition, see `#lib/filter/filter.ts`. */
	where?: string;
	/** Only return these fields; all of them when missing. */
	select?: string[];
	/** Relation fields to replace by their records: `author`, `comments.author` (see `include()`). */
	include?: string[];
};

/** What the records API returns of a record: `select` limits the fields, `include` relations. */
export type ApiReadOptions = { select?: string[]; include?: string[] };

export type ApiRecordList = {
	items: ApiRecord[];
	/** Records that match, on every page. */
	total: number;
	limit: number;
	offset: number;
};

/** Every error of the records service; callers branch on the codes they handle. */
export type RecordsError =
	| ContextError
	| CollectionLookupError
	| ServiceError<8000, 'RECORDS_FAILED'>
	| (ServiceError<8001, 'INVALID_RECORD'> & { data: { issues: RecordIssues } })
	| (ServiceError<8002, 'UNIQUE_VIOLATION'> & { data: { field: string } })
	| ServiceError<8003, 'RECORD_NOT_FOUND'>
	| ServiceError<8012, 'NO_FIELDS'>
	| ServiceError<8013, 'ACTION_NOT_AVAILABLE'>
	| ServiceError<8014, 'RULE_LOCKED'>
	| (ServiceError<8015, 'INVALID_QUERY'> & { data: { param: ApiQueryParam; message: string } })
	| (ServiceError<8016, 'INVALID_RULE'> & { data: { action: ApiRuleAction; message: string } })
	| ServiceError<8017, 'RULE_DENIED'>
	| (ServiceError<8019, 'RECORD_IN_USE'> & { data: { collection: string; field: string } })
	| ServiceError<8020, 'CASCADE_TOO_LARGE'>
	| (ServiceError<8021, 'RECORD_IS_DEFAULT'> & { data: { collection: string; field: string } });

/**
 * Records: the rows of a collection's table in the app database. The dashboard reads them as the
 * grid shows them (`list`, `get`), the records API with its rules and query parameters
 * (`apiList`, `apiGet`, ...), and both write through `create`, `update` and `delete`. The pure
 * parts live in `src/lib/server/records/`.
 */
export class RecordsService extends Service {
	/** One page of records as the grid shows them, plus the fields (columns) of the collection. */
	list(collectionName: string, options: ListRecordsOptions): ResultAsync<RecordPage, RecordsError> {
		return this.run(async () => {
			const context = await this.context(collectionName);
			const { collection, fields: collectionFields, databaseId } = context;
			const { key, created } = autoFields(collectionFields);
			const page = { fields: collectionFields, page: options.page, perPage: options.perPage };

			// Without fields the collection has no table yet.
			if (!collectionFields.length) {
				return { ...page, relationTargets: {}, items: [], total: 0, sort: key, order: 'desc' };
			}

			const sortable = collectionFields
				.filter((field) => field.type !== 'blob')
				.map((field) => field.name);
			const sort =
				options.sort && sortable.includes(options.sort) ? options.sort : (created[0] ?? key);
			const order = options.order === 'asc' ? 'asc' : 'desc';
			const [[total], grid] = await Promise.all([
				queryDatabase(databaseId, `SELECT count(*) FROM "${collection.name}"`),
				readGrid(
					this.services,
					context,
					`ORDER BY "${sort}" ${order}, "${key}" ${order} LIMIT ? OFFSET ?`,
					[options.perPage, (options.page - 1) * options.perPage]
				)
			]);

			return { ...page, ...grid, total: Number(total?.[0] ?? 0), sort, order };
		}, this.failed);
	}

	/**
	 * One record as shown in the grid (relations resolved to `{ id, label }`), e.g. to open a
	 * related record that isn't on the current page. `null` when it doesn't exist.
	 */
	get(
		collectionName: string,
		id: string
	): ResultAsync<{ item: RecordRow; signInMethods?: SignInMethod[] } | null, RecordsError> {
		return this.run(async () => {
			const context = await this.context(collectionName);
			const { key } = autoFields(context.fields);

			if (!context.fields.length) {
				return null;
			}

			const { items, signInMethods } = await readGrid(
				this.services,
				context,
				`WHERE "${key}" = ?`,
				keyParams(key, [id])
			);
			const [item] = items;

			return item ? { item, signInMethods: signInMethods?.[item._key] } : null;
		}, this.failed);
	}

	/**
	 * One page of records for the records API, filtered by `options.where` and by the collection's
	 * list rule: records the rule doesn't match are left out. Without `access` (an API key or the
	 * admin), the rule isn't checked. `options.include` replaces relations by their records
	 * (see `include()`).
	 */
	apiList(
		collectionName: string,
		options: ApiListOptions,
		access: ApiAccess | undefined
	): ResultAsync<ApiRecordList, RecordsError> {
		return this.run(async () => {
			const context = await this.context(collectionName);
			const { collection, fields: collectionFields, databaseId } = context;
			const { key, created } = autoFields(collectionFields);
			const rule = await guard(this.host, context, 'list', access);
			const empty = { items: [], total: 0, limit: options.limit, offset: options.offset };

			// Without fields the collection has no table yet.
			if (!collectionFields.length) {
				return empty;
			}

			const { where, sort, tree, selected } = await compileQuery(
				this.host,
				context,
				rule,
				options,
				access
			);
			// Without an order, records come in the order they were created.
			const order = [...(sort.length ? sort : [`"${created[0] ?? key}" ASC`]), `"${key}" ASC`].join(
				', '
			);
			const columns = selected.map((field) => `"${field.name}"`).join(', ');
			const [[total], rows] = await batchDatabase(databaseId, [
				{
					sql: `SELECT count(*) FROM "${collection.name}" WHERE ${where.sql}`,
					params: where.params
				},
				{
					sql: `SELECT ${columns} FROM "${collection.name}" WHERE ${where.sql} ORDER BY ${order} LIMIT ? OFFSET ?`,
					params: [...where.params, options.limit, options.offset]
				}
			]);
			const items = rows.map((row) => toApiRecord(selected, row));

			await deserialize(this.services.plugins(), collectionFields, items);
			await includeRelated(this.host, collectionFields, items, tree, access);

			return { ...empty, items, total: Number(total?.[0] ?? 0) };
		}, this.failed);
	}

	/**
	 * One record for the records API; `null` when it doesn't exist or the collection's view rule
	 * doesn't match it. Without `access`, the rule isn't checked; with `checkRule: false`, only
	 * the visibility of fields and included records is (for a record that was just written, and
	 * the user's own record). `select` limits the fields and `include` replaces relations by their
	 * records (see `include()`).
	 */
	apiGet(
		collectionName: string,
		id: string,
		options: ApiReadOptions & { access?: ApiAccess; checkRule?: boolean } = {}
	): ResultAsync<ApiRecord | null, RecordsError> {
		return this.run(
			async () => this.readOne(await this.context(collectionName), id, options),
			this.failed
		);
	}

	/**
	 * The signed-in user's own record, as `/api/auth/me` returns it: whatever the view rule of
	 * `users` says, but without the hidden fields, like every record an app user reads.
	 */
	apiSelf(user: Record<string, unknown>): ResultAsync<ApiRecord | null, RecordsError> {
		return this.apiGet(USERS_COLLECTION, String(user.id), { access: { user }, checkRule: false });
	}

	/** Creates a record through the records API (see `create`) and returns it (see `apiGet`). */
	apiCreate(
		collectionName: string,
		input: RecordInput,
		access: ApiAccess | undefined,
		options: ApiReadOptions = {}
	): ResultAsync<ApiRecord, RecordsError> {
		return this.run(async () => {
			const { id } = await this.must(this.create(collectionName, input, { access }));

			return this.found(collectionName, id, options, access);
		}, this.failed);
	}

	/**
	 * Updates the fields in `input` of a record through the records API (see `update`) and returns
	 * the record (see `apiGet`).
	 */
	apiUpdate(
		collectionName: string,
		id: string,
		input: RecordInput,
		access: ApiAccess | undefined,
		options: ApiReadOptions = {}
	): ResultAsync<ApiRecord, RecordsError> {
		return this.run(async () => {
			await this.must(this.update(collectionName, id, input, { partial: true, access }));

			return this.found(collectionName, id, options, access);
		}, this.failed);
	}

	/**
	 * Checks a query of the records API without running it: the collection offers `view` to
	 * `access` (its view rule compiles and isn't locked), and `where`, `select` and `include` are
	 * valid for the fields `access` may read; `include` is followed through the related
	 * collections. For realtime subscriptions, which run the same query on every event.
	 */
	checkQuery(
		collectionName: string,
		query: ApiQuery,
		access: ApiAccess | undefined
	): ResultAsync<void, RecordsError> {
		return this.run(async () => {
			const context = await this.context(collectionName);
			const rule = await guard(this.host, context, 'view', access);
			const { tree } = await compileQuery(this.host, context, rule, query, access);

			await includeRelated(this.host, context.fields, [], tree, access);
		}, this.failed);
	}

	/**
	 * Expands the relations in `expand` of `records` of a collection in place, as `?include=` does
	 * (see `include()`), for realtime events. Without records it only checks `expand`: every path
	 * must be a chain of relations to collections whose view rule `access` may use.
	 */
	apiInclude(
		collectionName: string,
		records: ApiRecord[],
		expand: string[],
		access: ApiAccess | undefined
	): ResultAsync<void, RecordsError> {
		return this.run(async () => {
			const { fields: collectionFields } = await this.context(collectionName);
			const tree = queryParam('include', () =>
				includeTree(visibleFields(collectionFields, access), expand)
			);

			await includeRelated(this.host, collectionFields, records, tree, access);
		}, this.failed);
	}

	/** Records of a collection to pick from in a relation field. */
	listOptions(collectionId: string): ResultAsync<RelationRef[], RecordsError> {
		return this.run(async () => {
			const appDatabase = await this.must(this.services.database().requireApp());
			const target = await relationTarget(collectionId);

			if (!target?.id) {
				return [];
			}

			const rows = await queryDatabase(
				appDatabase.id,
				`SELECT "${target.id}", "${target.label ?? target.id}" FROM "${target.collection.name}" ORDER BY "${target.created ?? 'rowid'}" DESC LIMIT 200`
			);

			return rows.map(([id, label]) => ({ id: String(id), label: String(label ?? id) }));
		}, this.failed);
	}

	/**
	 * The fields the record form can upload a new file for: `file` fields, such as the `avatar` of
	 * users, and single relation fields that point to the built-in `files` collection.
	 */
	fileFields(
		collectionName: string
	): ResultAsync<{ name: string; accept: string[]; maxSize: number }[], RecordsError> {
		return this.run(async () => {
			const { fields: collectionFields } = await this.context(collectionName);
			const found: { name: string; accept: string[]; maxSize: number }[] = [];

			for (const field of collectionFields) {
				if (field.type === 'file') {
					found.push({ name: field.name, ...fileFieldRules(field.options) });
					continue;
				}

				if (field.type !== 'relation' || field.options.multiple) {
					continue;
				}

				const target = await relationTarget(field.options.collectionId);

				if (target?.collection.system && target.collection.name === FILES_COLLECTION) {
					found.push({ name: field.name, ...fileFieldRules({}) });
				}
			}

			return found;
		}, this.failed);
	}

	/**
	 * Creates a record. With `access` (the records API), the collection's create rule must allow
	 * it; the rule sees the new record's values.
	 */
	create(
		collectionName: string,
		input: RecordInput,
		options: { access?: ApiAccess } = {}
	): ResultAsync<{ id: string }, RecordsError> {
		return this.run(
			async () => {
				const context = await this.context(collectionName);
				const { collection, fields: collectionFields, databaseId } = context;
				const condition = await guard(this.host, context, 'create', options.access, input);

				if (!collectionFields.length) {
					this.fail(8012, 'NO_FIELDS');
				}

				const values = await validateInput(
					this.services.plugins(),
					context,
					collectionFields,
					input,
					{ creating: true }
				);

				await fillSqlDefaults(databaseId, collectionFields, values);

				const auto = autoFields(collectionFields);
				const now = Date.now();
				const filled: Record<string, string | number> = Object.fromEntries(
					[...auto.created, ...auto.updated].map((name) => [name, now])
				);
				// `autoincrement` ids are assigned by the database.
				const id = auto.generator && generateId(auto.generator);

				if (auto.id && id) {
					filled[auto.id] = id;
				}

				for (const field of collectionFields) {
					if (
						field.type === 'date' &&
						field.defaultValue === NOW_DEFAULT &&
						values[field.name] === null
					) {
						filled[field.name] = new Date(now).toISOString();
					}
				}

				const computed = await computeValues(
					collection.name,
					collectionFields,
					{ ...values, ...filled },
					null
				);
				const record = { ...values, ...filled, ...computed };
				// Empty values are left out, so the column's DEFAULT applies.
				const entries = Object.entries(record).filter(([, value]) => value !== null);
				const columns = entries.map(([name]) => `"${name}"`).join(', ');
				const returned = returning(auto.key, collectionFields);
				let rows: unknown[][];

				if (condition === ALWAYS) {
					const insert = entries.length
						? `(${columns}) VALUES (${placeholders(entries)})`
						: 'DEFAULT VALUES';

					rows = await queryDatabase(
						databaseId,
						`INSERT INTO "${collection.name}" ${insert} RETURNING ${returned}`,
						entries.map(([, value]) => value)
					);
				} else {
					// The rule runs on the new record: a row with every field's value, which is only
					// inserted when it matches, in the same statement.
					const row = apiFields(collectionFields).map((field) => field.name);
					const target = entries.length ? `(${columns})` : '("rowid")';
					const selected = entries.length ? columns : 'NULL';

					rows = await queryDatabase(
						databaseId,
						`INSERT INTO "${collection.name}" ${target} SELECT ${selected} FROM (SELECT ${row.map((name) => `? AS "${name}"`).join(', ')}) AS "${collection.name}" WHERE ${condition.sql} RETURNING ${returned}`,
						[...row.map((name) => record[name] ?? null), ...condition.params]
					);

					if (!rows.length) {
						this.fail(8017, 'RULE_DENIED');
					}
				}

				this.announce(collection.name, 'create', collectionFields, rows);

				return { id: String(rows[0][0]) };
			},
			(error) => this.writeFailure(error)
		);
	}

	/**
	 * Updates a record. With `partial`, only the fields present in `input` are written; otherwise
	 * missing fields are cleared. With `access` (the records API), the collection's update rule
	 * must match the stored record, or it counts as not found.
	 */
	update(
		collectionName: string,
		id: string,
		input: RecordInput,
		options: { partial?: boolean; access?: ApiAccess } = {}
	): ResultAsync<{ id: string }, RecordsError> {
		return this.run(
			async () => {
				const context = await this.context(collectionName);
				const { collection, fields: collectionFields, databaseId } = context;
				const condition = await guard(this.host, context, 'update', options.access, input);

				if (!collectionFields.length) {
					this.fail(8003, 'RECORD_NOT_FOUND');
				}

				const values = await validateInput(
					this.services.plugins(),
					context,
					options.partial
						? collectionFields.filter((field) => field.name in input)
						: collectionFields,
					input,
					{ creating: false }
				);
				const now = Date.now();
				const updated = Object.fromEntries(
					autoFields(collectionFields).updated.map((name) => [name, now])
				);
				let record: Record<string, StoredValue> = { ...updated, ...values };

				if (computedSpecs(collectionFields).length) {
					// Computed fields see the whole record: the stored one with this save's changes.
					const previous =
						(await readStoredRecord(databaseId, collection.name, collectionFields, id)) ??
						this.fail(8003, 'RECORD_NOT_FOUND');
					const computed = await computeValues(
						collection.name,
						collectionFields,
						{ ...previous, ...record },
						previous
					);

					record = { ...record, ...computed };
				}

				const { key } = autoFields(collectionFields);
				const entries = Object.entries(record);
				const assignments = entries.map(([name]) => `"${name}" = ?`).join(', ');
				const where = `"${key}" = ? AND (${condition.sql})`;
				const rows = await queryDatabase(
					databaseId,
					// Nothing to write (no fields left to save): only check that the record exists.
					entries.length
						? `UPDATE "${collection.name}" SET ${assignments} WHERE ${where} RETURNING ${returning(key, collectionFields)}`
						: `SELECT "${key}" FROM "${collection.name}" WHERE ${where}`,
					[...entries.map(([, value]) => value), ...keyParams(key, [id]), ...condition.params]
				);

				if (!rows.length) {
					this.fail(8003, 'RECORD_NOT_FOUND');
				}

				if (entries.length) {
					this.announce(collection.name, 'update', collectionFields, rows);
				}

				return { id };
			},
			(error) => this.writeFailure(error)
		);
	}

	/**
	 * Deletes records. With `access` (the records API), only those that match the collection's
	 * delete rule are deleted.
	 *
	 * Relation fields that link to the deleted records follow their `onDelete` option (see
	 * `RELATION_ON_DELETE`): they are unlinked, the records that link are deleted too (without
	 * checking their delete rule), or nothing is deleted while a record links to them. A record that
	 * is the default value of a relation field can't be deleted.
	 */
	delete(
		collectionName: string,
		ids: string[],
		options: { access?: ApiAccess } = {}
	): ResultAsync<{ deleted: number }, RecordsError> {
		return this.run(
			async () => {
				const unique = [...new Set(ids)].slice(0, MAX_IDS);

				if (!unique.length) {
					return { deleted: 0 };
				}

				const context = await this.context(collectionName);
				const { collection, fields: collectionFields, databaseId } = context;
				const condition = await guard(this.host, context, 'delete', options.access);
				const { key } = autoFields(collectionFields);
				const params = keyParams(key, unique);

				if (!collectionFields.length || !params.length) {
					return { deleted: 0 };
				}

				const relations = await allRelations();

				// Nothing links to this collection: one statement deletes what the rule allows.
				if (!relations.some((relation) => linksTo(relation, collection.id))) {
					const stored = await storedFiles(context, unique);
					const rows = await queryDatabase(
						databaseId,
						`DELETE FROM "${collection.name}" WHERE "${key}" IN (${placeholders(params)}) AND (${condition.sql}) RETURNING ${returning(key, collectionFields)}`,
						[...params, ...condition.params]
					);

					await this.afterDelete(context, rows, stored);

					return { deleted: rows.length };
				}

				const allowed = await queryDatabase(
					databaseId,
					`SELECT "${key}" FROM "${collection.name}" WHERE "${key}" IN (${placeholders(params)}) AND (${condition.sql})`,
					[...params, ...condition.params]
				);

				if (!allowed.length) {
					return { deleted: 0 };
				}

				const plan = await deletionPlan(
					context,
					allowed.map(([id]) => String(id)),
					relations,
					(name) => this.relatedContext(name)
				);
				// Read before the delete: afterwards the rows are gone.
				const stored = await Promise.all(
					[...plan.deletes.values()].map((entry) => storedFiles(entry.context, [...entry.ids]))
				);
				const { unlinked, deleted } = await executeDeletion(databaseId, plan);

				for (const unlink of unlinked) {
					this.announce(
						unlink.context.collection.name,
						'update',
						unlink.context.fields,
						unlink.rows
					);
				}

				let count = 0;

				for (const [index, entry] of deleted.entries()) {
					await this.afterDelete(entry.context, entry.rows, stored[index]);

					// Only the requested records count, not those the delete cascaded to.
					if (entry.context.collection.id === collection.id) {
						count += entry.rows.filter(([id]) => unique.includes(String(id))).length;
					}
				}

				return { deleted: count };
			},
			(error) => {
				if (error instanceof RecordInUseFailure) {
					return {
						...this.error(8019, 'RECORD_IN_USE'),
						data: { collection: error.collection, field: error.field }
					};
				}

				if (error instanceof RecordIsDefaultFailure) {
					return {
						...this.error(8021, 'RECORD_IS_DEFAULT'),
						data: { collection: error.collection, field: error.field }
					};
				}

				if (error instanceof CascadeTooLargeFailure) {
					return this.error(8020, 'CASCADE_TOO_LARGE');
				}

				return this.failed(error);
			}
		);
	}

	/**
	 * Runs a computed field's calculation on the newest records without saving anything, so a
	 * script can be tried out (see `previewComputed` in `records/write.ts`).
	 */
	previewComputed(
		collectionName: string,
		options: FieldOptions
	): ResultAsync<ComputedPreview, RecordsError> {
		return this.run(
			async () => previewComputed(await this.context(collectionName), options),
			this.failed
		);
	}

	/**
	 * Recalculates the computed fields of records that were written without this service, such as
	 * users created by a sign-up or uploaded files.
	 */
	refreshComputed(collectionName: string, ids: string[]): ResultAsync<void, RecordsError> {
		return this.run(async () => {
			const {
				collection,
				fields: collectionFields,
				databaseId
			} = await this.context(collectionName);

			// Lenient: these rows are already saved, so a failing script leaves its field empty.
			await fillComputedColumns(
				databaseId,
				collection.name,
				readableColumns(collectionFields),
				computedSpecs(collectionFields),
				{ ids, key: autoFields(collectionFields).key, lenient: true }
			);
		}, this.failed);
	}

	/**
	 * Sends the realtime events of records that another service wrote directly, such as sign-ups
	 * and uploads. Best effort: it never fails (a problem is logged), so callers run it with
	 * `inBackground()`.
	 */
	announceStored(
		collectionName: string,
		action: 'create' | 'update',
		ids: string[]
	): ResultAsync<void, RecordsError> {
		return this.run(async () => {
			try {
				const {
					collection,
					fields: collectionFields,
					databaseId
				} = await this.context(collectionName);
				const { key } = autoFields(collectionFields);
				const params = keyParams(key, ids);

				if (!collectionFields.length || !params.length) {
					return;
				}

				const rows = await queryDatabase(
					databaseId,
					`SELECT ${returning(key, collectionFields)} FROM "${collection.name}" WHERE "${key}" IN (${placeholders(params)})`,
					params
				);

				this.announce(collection.name, action, collectionFields, rows);
			} catch (error) {
				console.error('[realtime] could not read the changed records', error);
			}
		}, this.failed);
	}

	/**
	 * The collections that relations point to, when one of `texts` (conditions) has a path such as
	 * `author.role`; `undefined` otherwise, so plain conditions read nothing. Related records are
	 * checked against their view rule for `access` (see `relatedCollections`).
	 */
	filterRelations(
		texts: (string | null | undefined)[],
		access?: ApiAccess
	): ResultAsync<FilterContext['relations'], ServiceError<6000, 'COLLECTIONS_FAILED'>> {
		return this.run(
			() => filterRelations(this.host, texts, access),
			(error) => this.error(6000, 'COLLECTIONS_FAILED', error)
		);
	}

	/** The error of anything unexpected: the reason says what broke. */
	private failed = (error: unknown) => this.error(8000, 'RECORDS_FAILED', error);

	/** The error of a failed write: the field of a unique index that refused the value, or `failed`. */
	private writeFailure(error: unknown) {
		const field = uniqueViolation(error);

		return field
			? { ...this.error(8002, 'UNIQUE_VIOLATION'), data: { field } }
			: this.failed(error);
	}

	/** The collection, its fields and the app database id, read in parallel. */
	private async context(collectionName: string): Promise<RecordContext> {
		const [{ collection, fields: collectionFields }, appDatabase] = await Promise.all([
			this.must(this.services.collections().requireWithFields(collectionName)),
			this.must(this.services.database().requireApp())
		]);

		return { collection, fields: collectionFields, databaseId: appDatabase.id };
	}

	/**
	 * The context of a collection that another one's records link to; when it can't be read, the
	 * operation on the other collection fails (not with the related collection's error).
	 */
	private async relatedContext(collectionName: string): Promise<RecordContext> {
		try {
			return await this.context(collectionName);
		} catch (error) {
			throw new Error(`Could not read collection ${collectionName}: ${reasonOf(error)}`, {
				cause: error
			});
		}
	}

	/**
	 * One record as the records API returns it, or `null`. The view rule is checked for `access`
	 * unless `checkRule` is `false`; the visibility of fields and included records always is.
	 */
	private async readOne(
		context: RecordContext,
		id: string,
		{
			select,
			include,
			access,
			checkRule = true
		}: ApiReadOptions & { access?: ApiAccess; checkRule?: boolean }
	): Promise<ApiRecord | null> {
		const { collection, fields: collectionFields, databaseId } = context;
		const rule = checkRule ? await guard(this.host, context, 'view', access) : ALWAYS;
		const readable = visibleFields(collectionFields, access);
		const { key } = autoFields(collectionFields);

		if (!collectionFields.length) {
			return null;
		}

		const tree = queryParam('include', () => includeTree(readable, include));
		const selected = queryParam('select', () => selectFields(readable, withIncluded(select, tree)));
		const [row] = await queryDatabase(
			databaseId,
			`SELECT ${selected.map((field) => `"${field.name}"`).join(', ')} FROM "${collection.name}" WHERE "${key}" = ? AND (${rule.sql})`,
			[...keyParams(key, [id]), ...rule.params]
		);

		if (!row) {
			return null;
		}

		const record = toApiRecord(selected, row);

		await deserialize(this.services.plugins(), collectionFields, [record]);
		await includeRelated(this.host, collectionFields, [record], tree, access);

		return record;
	}

	/**
	 * A record that was just written, as the API returns it, whatever its view rule; the records it
	 * links to only when their view rules let `access` see them.
	 */
	private async found(
		collectionName: string,
		id: string,
		options: ApiReadOptions,
		access: ApiAccess | undefined
	): Promise<ApiRecord> {
		const record = await this.readOne(await this.context(collectionName), id, {
			...options,
			access,
			checkRule: false
		});

		return record ?? this.fail(8003, 'RECORD_NOT_FOUND');
	}

	/** What the rule checks (`records/rules.ts`) and `includeRelated()` need from this service. */
	private get host(): IncludeHost {
		return {
			context: (name) => this.context(name),
			collections: this.services.collections(),
			plugins: this.services.plugins()
		};
	}

	/**
	 * Sends the realtime events of deleted rows (see `returning()`) and removes what belongs to
	 * them: the provider accounts and passwords of users, and the stored files of `files`.
	 */
	private async afterDelete(context: RecordContext, rows: unknown[][], stored: unknown[][]) {
		const { collection, fields: collectionFields, databaseId } = context;
		const deleted = rows.map(([id]) => String(id));

		this.announce(collection.name, 'delete', collectionFields, rows);

		// Deleted users lose their linked provider accounts too.
		if (deleted.length && collection.system && collection.name === USERS_COLLECTION) {
			await batchDatabase(databaseId, userCleanupStatements(deleted));
		}

		// Deleted files are removed from storage too (the original and every stored thumbnail);
		// leftovers don't break anything.
		const keys = storageKeysOf(stored, deleted);

		if (keys.length) {
			await this.services.storage().delete(keys);
		}
	}

	/**
	 * Sends the realtime events of written rows (the key, then the API fields; see `returning()`)
	 * in the background: the write never waits for them.
	 */
	private announce(
		collectionName: string,
		action: RealtimeAction,
		collectionFields: Field[],
		rows: unknown[][]
	) {
		if (!rows.length) {
			return;
		}

		const readable = apiFields(collectionFields);
		const at = Date.now();

		inBackground(
			this.services.realtime().publish(
				rows.map(([id, ...values]) => ({
					collection: collectionName,
					action,
					id: String(id),
					row: Object.fromEntries(readable.map((field, index) => [field.name, values[index]])),
					at
				}))
			)
		);
	}
}
