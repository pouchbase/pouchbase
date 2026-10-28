import type { ApiRuleAction } from '#lib/filter/rules.js';
import type { FilterContext, SqlCondition } from '../filter';
import type { CollectionsService } from '../services/collections.service';
import type { ApiAccess } from './access';
import type { RecordContext, RecordInput } from './values';

import { USERS_COLLECTION } from '#lib/auth/users.js';
import { FilterError } from '#lib/filter/filter.js';
import { apiActions } from '#lib/filter/rules.js';

import { Failure, unwrap } from '../failure';
import { ALWAYS, both, compileFilter, compileOrder, compileRule, usesRelations } from '../filter';
import { pluginMay } from '../plugins/grant';
import {
	accessUser,
	checkUserFields,
	protectedWrites,
	relatedCollections,
	visibleFields
} from './access';
import { includeTree, selectFields, withIncluded } from './query';
import { apiFields } from './values';
import { invalidRecord } from './write';

/**
 * What the records API lets `access` do: the collection's API rules compiled to SQL conditions,
 * and the query parameters (`where`, `order`, `select`, `include`) checked against the fields
 * it may read. Every function throws the `Failure` of a refusal.
 */

/** What the rule checks need from the records service. */
export type RulesHost = {
	/** The context of a collection by name. */
	context(collectionName: string): Promise<RecordContext>;
	collections: CollectionsService;
};

/** The query parameters of the records API that `INVALID_QUERY` can be about. */
export type ApiQueryParam = 'where' | 'order' | 'select' | 'include';

/** A query of the records API: what `apiList` takes besides the page. */
export type ApiQuery = {
	where?: string | null;
	order?: string | null;
	select?: string[] | null;
	include?: string[] | null;
};

/** Runs `compile` for a query parameter; a `FilterError` becomes an `INVALID_QUERY` failure. */
export function queryParam<T>(param: ApiQueryParam, compile: () => T): T {
	try {
		return compile();
	} catch (error) {
		throw new Failure({
			code: 8015,
			message: 'INVALID_QUERY',
			data: { param, message: error instanceof FilterError ? error.message : `Invalid ${param}` }
		});
	}
}

/**
 * The SQL condition of the collection's API rule for `action`, for a request with `access`;
 * without `access` (the dashboard), every record. Fails when the API doesn't offer the action
 * for this collection, when the rule is locked or invalid, or when `input` writes a protected
 * field.
 */
export async function guard(
	host: RulesHost,
	context: RecordContext,
	action: ApiRuleAction,
	access: ApiAccess | undefined,
	input?: RecordInput
): Promise<SqlCondition> {
	const { collection, fields: collectionFields } = context;

	if (!access) {
		return ALWAYS;
	}

	if (!apiActions(collection).includes(action)) {
		throw new Failure({ code: 8013, message: 'ACTION_NOT_AVAILABLE' });
	}

	if ('plugin' in access && !pluginMay(access.plugin, action, collection.name)) {
		throw new Failure({ code: 8014, message: 'RULE_LOCKED' });
	}

	const written = protectedWrites(collection, collectionFields, access, input);

	if (written.length) {
		throw invalidRecord(
			Object.fromEntries(written.map((name) => [name, "Can't be changed through the records API"]))
		);
	}

	if ('plugin' in access) {
		return ALWAYS;
	}

	const rule = collection.settings.rules?.[action];
	// The rule's own paths through relations see every related record.
	const relations = await filterRelations(host, [rule], undefined);
	let condition: SqlCondition | null;

	try {
		condition = compileRule(rule, apiFields(collectionFields), {
			user: access.user,
			input,
			table: collection.name,
			relations
		});
	} catch (error) {
		throw new Failure({
			code: 8016,
			message: 'INVALID_RULE',
			data: { action, message: error instanceof Error ? error.message : String(error) }
		});
	}

	if (!condition) {
		throw new Failure({ code: 8014, message: 'RULE_LOCKED' });
	}

	return condition;
}

/**
 * The parts of a query of the records API: the condition (the rule and `where`), the
 * `ORDER BY` terms, the include tree and the fields to select, for what `access` may read.
 */
export async function compileQuery(
	host: RulesHost,
	context: RecordContext,
	rule: SqlCondition,
	query: ApiQuery,
	access: ApiAccess | undefined
) {
	const { collection, fields: collectionFields } = context;
	const readable = visibleFields(collectionFields, access);
	const relations = await filterRelations(host, [query.where], access);
	const userFields = await userFieldsOf(host, query.where, access);
	const where = queryParam('where', () => {
		if (userFields) {
			checkUserFields(query.where, userFields);
		}

		return query.where?.trim()
			? both(
					rule,
					compileFilter(query.where, readable, {
						user: accessUser(access),
						table: collection.name,
						relations
					})
				)
			: rule;
	});
	const sort = queryParam('order', () => compileOrder(query.order ?? '', readable));
	const tree = queryParam('include', () => includeTree(readable, query.include ?? undefined));
	const selected = queryParam('select', () =>
		selectFields(readable, withIncluded(query.select ?? undefined, tree))
	);

	return { where, sort, tree, selected };
}

/**
 * The collections that relations point to, when one of `texts` (conditions) has a path such as
 * `author.role`; `undefined` otherwise, so plain conditions read nothing. Related records are
 * checked against their view rule for `access` (see `relatedCollections`).
 */
export async function filterRelations(
	host: RulesHost,
	texts: (string | null | undefined)[],
	access: ApiAccess | undefined
): Promise<FilterContext['relations']> {
	if (!usesRelations(texts)) {
		return undefined;
	}

	return relatedCollections(await unwrap(host.collections.listWithFields()), access);
}

/**
 * The fields of `users` that `access` may read through `$user` in a condition of its own, when
 * `text` uses `$user` and `access` is an app user; `null` otherwise (nothing to check).
 */
async function userFieldsOf(
	host: RulesHost,
	text: string | null | undefined,
	access: ApiAccess | undefined
) {
	if (!access || !('user' in access) || !text?.includes('$user.')) {
		return null;
	}

	const { fields: userFields } = await host.context(USERS_COLLECTION);

	return visibleFields(userFields, access);
}
