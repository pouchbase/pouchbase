import type { FilterExpression } from '#lib/filter/filter.js';
import type { RealtimeAction } from '#lib/realtime/protocol.js';
import type { FilterContext, FilterSchemaField, SqlCondition } from '../filter';
import type { AccessContext, Subject } from './hub-core';

import { filterFields, filterValues, parseFilter } from '#lib/filter/filter.js';

import { ALWAYS, both, compileFilter, compileRule, evaluateFilter, usesRelations } from '../filter';

/**
 * Who may see a realtime event: the collection's view rule and the subscription's filter, checked
 * once per access context (a subject with a filter). The condition runs on the event's own values,
 * the way the create rule runs on a new record. So a deleted record is checked as it was, and a
 * later write can't change the outcome.
 *
 * Contexts that the condition can't tell apart (the same filter and the same values of the
 * `$user` fields it reads) are checked once. The condition is evaluated in memory when it can be
 * (`evaluateFilter`), so an event costs no query however many users subscribe; otherwise it runs
 * on a row made of bound parameters, one statement per group.
 */

export type Statement = { sql: string; params: (string | number | null)[] };

/**
 * Per context: allowed or denied right away, or a statement that returns a row when allowed.
 * Contexts in the same group share the statement object, so it runs once.
 */
export type AuthorizeCheck = { key: string } & Outcome;

type Outcome =
	{ allowed: boolean; statement?: undefined } | { statement: Statement; allowed?: undefined };

/** D1 allows at most 100 bound parameters per statement. */
const MAX_PARAMS = 95;

type Readable = FilterSchemaField;

type Options = {
	action: RealtimeAction;
	viewRule: string | null | undefined;
	viewOffered: boolean;
	readable: Readable[];
	row: Record<string, unknown>;
	table: string;
	key: string;
	keyParam: string | number;
	contexts: AccessContext[];
	/**
	 * The collections relations point to, for a view rule or filter with a path such as
	 * `author.role`: as the view rule sees them without a subject, as a subject's filter sees
	 * them with one.
	 */
	relations?: (subject?: Subject) => FilterContext['relations'];
};

function bindable(value: unknown): string | number | null {
	if (value === undefined || value === null) {
		return null;
	}

	if (typeof value === 'number' || typeof value === 'string') {
		return value;
	}

	if (typeof value === 'boolean') {
		return value ? 1 : 0;
	}

	return JSON.stringify(value);
}

function parsed(text: string | null | undefined): FilterExpression | null {
	try {
		return text?.trim() ? parseFilter(text) : null;
	} catch {
		return null;
	}
}

/** The fields an expression reads, or none when it doesn't parse (compiling reports that). */
function referenced(text: string | null | undefined) {
	const expression = parsed(text);

	return expression ? filterFields(expression) : [];
}

/** The `$user` fields an expression reads, or none when it doesn't parse. */
function userFields(text: string | null | undefined): string[] {
	const expression = parsed(text);

	return expression
		? filterValues(expression).flatMap((value) => (value.kind === 'user' ? [value.name] : []))
		: [];
}

/**
 * What the outcome for a subject depends on: whether it is an admin (the rule doesn't apply), the
 * filter, and the values of the `$user` fields, bound as `compileFilter` binds them.
 */
function groupKey(subject: Subject, filter: string | null, names: string[] | null) {
	if (subject.kind === 'admin') {
		return JSON.stringify(['admin', filter]);
	}

	const auth = subject.kind === 'user' ? subject.auth : null;

	// `null`: the view rules of related collections may read any field of the user.
	return JSON.stringify([
		'subject',
		filter,
		names ? names.map((name) => (auth ? bindable(auth[name]) : '')) : auth
	]);
}

/** The check for one group of contexts, made for one subject of it. */
function check(options: Options, subject: Subject, filter: string | null): Outcome {
	const { readable, row, table } = options;
	const auth = subject.kind === 'user' ? subject.auth : null;
	const viewRule = subject.kind === 'admin' ? null : options.viewRule;
	let condition: SqlCondition | null;

	try {
		const rule =
			subject.kind === 'admin'
				? ALWAYS
				: options.viewOffered
					? compileRule(viewRule, readable, {
							user: auth,
							table,
							relations: options.relations?.()
						})
					: null;

		condition =
			rule && filter
				? both(
						rule,
						compileFilter(filter, readable, {
							user: auth,
							table,
							relations: options.relations?.(subject)
						})
					)
				: rule;
	} catch {
		// A rule or filter that no longer compiles (a field was renamed) lets nothing through.
		return { allowed: false };
	}

	if (!condition) {
		return { allowed: false };
	}

	if (condition === ALWAYS) {
		return { allowed: true };
	}

	const parts = [viewRule, filter].filter((text): text is string => Boolean(text?.trim()));
	const outcomes = parts.map((text) => evaluateFilter(text, readable, { user: auth }, row));

	if (outcomes.every((outcome) => outcome !== undefined)) {
		return { allowed: outcomes.every(Boolean) };
	}

	const names = new Set([...referenced(viewRule), ...referenced(filter)]);
	const columns = readable.filter((field) => names.has(field.name));

	if (columns.length + condition.params.length <= MAX_PARAMS) {
		const values = columns.length
			? columns.map((field) => `? AS "${field.name}"`).join(', ')
			: `1 AS "_"`;

		return {
			statement: {
				sql: `SELECT 1 FROM (SELECT ${values}) AS "${table}" WHERE ${condition.sql}`,
				params: [...columns.map((field) => bindable(row[field.name])), ...condition.params]
			}
		};
	}

	// Too many parameters for a row of values: check the stored record instead. A deleted
	// record is gone, so its event isn't sent.
	if (options.action === 'delete' || condition.params.length + 1 > MAX_PARAMS) {
		return { allowed: false };
	}

	return {
		statement: {
			sql: `SELECT 1 FROM "${options.table}" WHERE "${options.key}" = ? AND (${condition.sql})`,
			params: [options.keyParam, ...condition.params]
		}
	};
}

/**
 * The checks for one event of a collection, one per context.
 *
 * @param options.viewRule - The collection's view rule (`null` or missing: locked).
 * @param options.viewOffered - Whether the records API offers `view` for the collection.
 * @param options.readable - The fields the API reads (all but blobs).
 * @param options.row - The event's stored values, by field name.
 * @param options.table / options.key / options.keyParam - For the fallback on the table, when the
 *   condition can't be evaluated in memory and needs more parameters than a statement may have.
 */
export function authorizationChecks(options: Options): AuthorizeCheck[] {
	const ruleUserFields = userFields(options.viewRule);
	const filterUserFields = new Map<string | null, string[]>();
	const groups = new Map<string, Outcome>();

	return options.contexts.map(({ key, subject, filter }): AuthorizeCheck => {
		let names = filterUserFields.get(filter);

		if (!names) {
			names = [...ruleUserFields, ...userFields(filter)];
			filterUserFields.set(filter, names);
		}

		const group = groupKey(
			subject,
			filter,
			subject.kind === 'admin' ? [] : usesRelations([filter]) ? null : names
		);
		let outcome = groups.get(group);

		if (!outcome) {
			outcome = check(options, subject, filter);
			groups.set(group, outcome);
		}

		return { key, ...outcome };
	});
}
