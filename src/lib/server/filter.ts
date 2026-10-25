import type {
	CompareOperator,
	FilterCall,
	FilterExpression,
	FilterField,
	FilterValue
} from '#lib/filter/filter.js';
import type { Field } from './services/fields.service';

import { FilterError, filterValues, MAX_RELATION_DEPTH, parseFilter } from '#lib/filter/filter.js';
import { normalizeUnit } from '#lib/filter/functions.js';

/**
 * Compiles filter expressions (`#lib/filter/filter.ts`) to a SQL condition with bound parameters,
 * for `?where=` and the API rules of the records API. Throws a `FilterError` for unknown fields.
 *
 * Field names are checked against the collection's fields before they end up in the SQL, and
 * every value is a bound parameter, so a filter can never inject SQL.
 *
 * A path through relations (`post.author.role`) becomes a correlated subquery on the related
 * collection, which needs `context.relations` and `context.table`.
 */

export type SqlCondition = { sql: string; params: (string | number | null)[] };

/** What a condition needs to know of a field: relations also where they point to. */
export type FilterSchemaField = Pick<Field, 'name' | 'type'> & {
	options?: Pick<Field['options'], 'collectionId' | 'multiple'>;
};

/** A collection that relations point to, for paths such as `author.role`. */
export type RelatedCollection = {
	/** Its table. */
	name: string;
	/** The column of its `id` field; `null` without one, and then relations can't be followed. */
	key: string | null;
	fields: FilterSchemaField[];
	/**
	 * The view rule its records are checked against: `undefined` checks none (API rules, which
	 * the admin wrote, and admins), `null` hides them all (a locked rule), `''` shows them all.
	 */
	rule?: string | null;
};

/** What `$user` and `$input` refer to while the condition runs. */
export type FilterContext = {
	/** The signed-in user (a row of `users`), or `null`; every `$user.*` is `""` then. */
	user: Record<string, unknown> | null;
	/** The submitted fields, for create and update rules. */
	input?: Record<string, unknown>;
	/**
	 * The table (or alias) of the records the condition runs on. Fields are qualified with it, so
	 * they stay the record's own inside subqueries.
	 */
	table?: string;
	/** The collection with this id, for paths through relations; without it they fail. */
	relations?: (collectionId: string) => RelatedCollection | undefined;
};

type FieldMap = Map<string, FilterSchemaField>;

/** The rows `any()` goes through and the value of each, wrapped around the condition. */
type AnySource = { from: string[]; where: string[]; params: SqlCondition['params'] };

/**
 * What a value holds, as far as it is known: `millis` for Created and Updated fields
 * (milliseconds since 1970), `date` for ISO 8601 text (Date fields and the date functions).
 */
type ValueType = 'millis' | 'date' | 'number' | 'other';

type CompiledValue = SqlCondition & {
	type: ValueType;
	/** The literal `""` or `null`. */
	empty?: boolean;
	/** The value in milliseconds, when it is known up front (a date literal, `now()`, `today()`). */
	millis?: number;
	/** The text of a string literal. */
	literal?: string;
};

/** Everything compiling or evaluating a condition needs. */
type Scope = {
	fields: FieldMap;
	context: FilterContext;
	/** The moment of every `now()` and `today()` in the condition. */
	now: Date;
	/** Counts the aliases of related tables, so each is unique in the whole statement. */
	aliases: { count: number };
	/** How many view rules of related collections deep this scope is. */
	depth: number;
	/** The source of the `any()` in the comparison being compiled. */
	any?: AnySource;
};

/** The same condition for every record. */
export const ALWAYS: SqlCondition = { sql: '1', params: [] };

/** ISO 8601 as `Date.toISOString()` writes it, in `strftime()`. */
const ISO_FORMAT = `'%Y-%m-%dT%H:%M:%fZ'`;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** SQLite's modifier of each unit of `date_add()`; weeks are 7 days. */
const DATE_ADD_MODIFIERS: Record<string, { unit: string; factor: number }> = {
	years: { unit: 'years', factor: 1 },
	months: { unit: 'months', factor: 1 },
	weeks: { unit: 'days', factor: 7 },
	days: { unit: 'days', factor: 1 },
	hours: { unit: 'hours', factor: 1 },
	minutes: { unit: 'minutes', factor: 1 },
	seconds: { unit: 'seconds', factor: 1 }
};

/** `strftime()` field of the functions that take a part of a date. */
const DATE_PARTS: Partial<Record<FilterCall['name'], string>> = {
	year: '%Y',
	month: '%m',
	day: '%d',
	hour: '%H',
	minute: '%M'
};

/** A value from the request as a bound parameter: booleans as `1`/`0`, objects as JSON. */
function bindable(value: unknown): string | number | null {
	if (value === undefined || value === null) {
		return null;
	}

	if (typeof value === 'boolean') {
		return value ? 1 : 0;
	}

	if (typeof value === 'number' || typeof value === 'string') {
		return value;
	}

	return JSON.stringify(value);
}

/** Milliseconds of a date in a string literal, such as `"2026-01-01"`; UTC unless it says so. */
function literalMillis(text: string): number | undefined {
	const match = ISO_DATE.exec(text);

	if (!match) {
		return undefined;
	}

	const iso = text.replace(' ', 'T');
	const time = Date.parse(match[1] && !match[4] ? `${iso}Z` : iso);

	return Number.isNaN(time) ? undefined : time;
}

function fieldType(field: Pick<FilterSchemaField, 'type'>): ValueType {
	switch (field.type) {
		case 'created':
		case 'updated':
			return 'millis';
		case 'date':
			return 'date';
		case 'number':
		case 'integer':
			return 'number';
		default:
			return 'other';
	}
}

function parameter(value: string | number | null): CompiledValue {
	return { sql: '?', params: [value], type: typeof value === 'number' ? 'number' : 'other' };
}

function knownField(name: string, fields: FieldMap, collection?: string) {
	const found = fields.get(name);

	if (!found || found.type === 'blob') {
		throw new FilterError(
			collection ? `\`${name}\` is not a field of ${collection}` : `Unknown field \`${name}\``
		);
	}

	return found;
}

/** A column of the records the scope is about, qualified when they have a table. */
function column(scope: Scope, name: string) {
	return scope.context.table ? `"${scope.context.table}"."${name}"` : `"${name}"`;
}

/** The items of a JSON array (multiple relations, files and lists); a single value is one item. */
function itemsOf(sql: string) {
	return `json_each(CASE WHEN json_valid(${sql}) AND json_type(${sql}) = 'array' THEN ${sql} ELSE json_array(${sql}) END)`;
}

function isMultiple(field: FilterSchemaField) {
	return (
		(field.type === 'relation' || field.type === 'file' || field.type === 'list') &&
		!!field.options?.multiple
	);
}

/** One step through a relation: the collection it points to, its alias and its view rule. */
type Hop = { target: RelatedCollection; key: string; alias: string; rule: SqlCondition | null };

function hop(field: FilterSchemaField, path: string, scope: Scope): Hop {
	if (field.type !== 'relation') {
		throw new FilterError(`\`${field.name}\` is not a relation, so \`${path}\` doesn't exist`);
	}

	const target = field.options?.collectionId
		? scope.context.relations?.(field.options.collectionId)
		: undefined;

	if (!scope.context.relations || !scope.context.table) {
		throw new FilterError(`Fields of related records (\`${path}\`) aren't supported here`);
	}

	if (!target?.key) {
		throw new FilterError(`\`${field.name}\` doesn't point to records with an id`);
	}

	if (target.rule === null) {
		throw new FilterError(
			`The API doesn't show records of \`${target.name}\`, so \`${path}\` can't be used`
		);
	}

	const alias = `_r${++scope.aliases.count}`;
	let rule: SqlCondition | null = null;

	if (target.rule?.trim()) {
		if (scope.depth >= MAX_RELATION_DEPTH) {
			throw new FilterError(`\`${path}\` goes through too many view rules of related records`);
		}

		// The view rule of the related collection, on its row in the subquery.
		rule = compileExpression(parseFilter(target.rule), {
			...scope,
			fields: new Map(target.fields.map((candidate) => [candidate.name, candidate])),
			context: { user: scope.context.user, table: alias, relations: scope.context.relations },
			depth: scope.depth + 1,
			any: undefined
		});
	}

	return { target, key: target.key, alias, rule };
}

/** `author.role`: the field of the related record, as a subquery per relation (NULL without). */
function pathValue(value: FilterField, scope: Scope): CompiledValue {
	const names = [value.name, ...(value.path ?? [])];
	const path = names.join('.');

	const build = (
		field: FilterSchemaField,
		source: string,
		index: number
	): CompiledValue & { field: FilterSchemaField } => {
		if (isMultiple(field)) {
			throw new FilterError(`\`${field.name}\` holds several records; use \`any(${path})\``);
		}

		const { target, key, alias, rule } = hop(field, path, scope);
		const next = knownField(
			names[index],
			new Map(target.fields.map((candidate) => [candidate.name, candidate])),
			target.name
		);
		const columnSql = `"${alias}"."${next.name}"`;
		const inner =
			index === names.length - 1
				? { sql: columnSql, params: [], type: fieldType(next), field: next }
				: build(next, columnSql, index + 1);
		const where = rule ? ` AND (${rule.sql})` : '';

		return {
			sql: `(SELECT ${inner.sql} FROM "${target.name}" AS "${alias}" WHERE "${alias}"."${key}" = ${source}${where})`,
			params: [...inner.params, ...(rule?.params ?? [])],
			type: inner.type,
			field: inner.field
		};
	};

	const first = knownField(value.name, scope.fields);
	const { sql, params, type } = build(first, column(scope, first.name), 1);

	return { sql, params, type };
}

/**
 * `any(tags)`, `any(editors.role)`: the rows to go through, joined relation by relation, and the
 * value of each. The caller wraps the condition in `EXISTS (SELECT 1 FROM … WHERE …)`.
 */
function anyValue(value: FilterField, scope: Scope): CompiledValue {
	const names = [value.name, ...(value.path ?? [])];
	const path = names.join('.');
	const source: AnySource = { from: [], where: [], params: [] };
	let field = knownField(value.name, scope.fields);
	let columnSql = column(scope, field.name);

	for (let index = 1; index < names.length; index++) {
		const { target, key, alias, rule } = hop(field, path, scope);

		if (isMultiple(field)) {
			const items = `_j${alias.slice(2)}`;

			source.from.push(`${itemsOf(columnSql)} AS "${items}"`);
			source.where.push(`"${alias}"."${key}" = "${items}"."value"`);
		} else {
			source.where.push(`"${alias}"."${key}" = ${columnSql}`);
		}

		source.from.push(`"${target.name}" AS "${alias}"`);

		if (rule) {
			source.where.push(`(${rule.sql})`);
			source.params.push(...rule.params);
		}

		field = knownField(
			names[index],
			new Map(target.fields.map((candidate) => [candidate.name, candidate])),
			target.name
		);
		columnSql = `"${alias}"."${field.name}"`;
	}

	scope.any = source;

	// A single value at the end of a path is the value itself.
	if (names.length > 1 && !isMultiple(field)) {
		return { sql: columnSql, params: [], type: fieldType(field) };
	}

	const items = `_j${++scope.aliases.count}`;

	source.from.push(`${itemsOf(columnSql)} AS "${items}"`);

	return { sql: `"${items}"."value"`, params: [], type: 'other' };
}

/** `now()` and `today()`, which `evaluateFilter` knows as well. */
function moment(name: 'now' | 'today', now: Date): CompiledValue {
	if (name === 'now') {
		return { ...parameter(now.toISOString()), type: 'date', millis: now.getTime() };
	}

	const day = now.toISOString().slice(0, 10);

	return { ...parameter(day), type: 'date', millis: Date.parse(day) };
}

/** The arguments of a date function for a value: milliseconds go through `'unixepoch'`. */
function timeValue(value: CompiledValue) {
	return value.type === 'millis' || value.type === 'number'
		? `${value.sql} / 1000.0, 'unixepoch'`
		: value.sql;
}

/** `text` with an empty value as `''`, as the text functions take it. */
function text(value: CompiledValue) {
	return `COALESCE(${value.sql}, '')`;
}

function compileCall(call: FilterCall, scope: Scope): CompiledValue {
	const args = call.args.map((arg) => compileValue(arg, scope));
	const params = args.flatMap((arg) => arg.params);
	const [first, second] = args;
	const result = (sql: string, type: ValueType, values = params): CompiledValue => ({
		sql,
		params: values,
		type
	});
	const part = DATE_PARTS[call.name];

	if (part) {
		return result(`CAST(strftime('${part}', ${timeValue(first)}) AS INTEGER)`, 'number');
	}

	switch (call.name) {
		case 'contains':
			return result(`instr(lower(${text(first)}), lower(${text(second)})) > 0`, 'other');
		case 'starts_with':
		case 'ends_with': {
			const start = call.name === 'starts_with';

			if (second.literal !== undefined) {
				const length = [...second.literal].length;

				return length
					? result(
							`substr(lower(${text(first)}), ${start ? `1, ${length}` : -length}) = lower(?)`,
							'other'
						)
					: result('1', 'other', []);
			}

			const search = text(second);
			const sql = start
				? `substr(lower(${text(first)}), 1, length(${search})) = lower(${search})`
				: `(length(${search}) = 0 OR substr(lower(${text(first)}), -length(${search})) = lower(${search}))`;
			const values = start
				? [...first.params, ...second.params, ...second.params]
				: [...second.params, ...first.params, ...second.params, ...second.params];

			return result(sql, 'other', values);
		}
		case 'like':
			return result(`${text(first)} LIKE ${text(second)}`, 'other');
		case 'lower':
		case 'upper':
		case 'trim':
			return result(`${call.name}(${first.sql})`, 'other');
		case 'length':
			return result(`length(${text(first)})`, 'number');
		case 'abs':
			return result(`abs(${first.sql})`, 'number');
		case 'round':
			return result(`round(${args.map((arg) => arg.sql).join(', ')})`, 'number');
		case 'count': {
			// A JSON array (multiple relations, files and lists), or a single value as one item.
			const value = first.sql;

			return result(
				`(CASE WHEN json_valid(${value}) AND json_type(${value}) = 'array' THEN json_array_length(${value}) WHEN COALESCE(${value}, '') = '' THEN 0 ELSE 1 END)`,
				'number',
				[...first.params, ...first.params, ...first.params, ...first.params]
			);
		}
		case 'now':
		case 'today':
			return moment(call.name, scope.now);
		case 'date':
			return result(`strftime('%Y-%m-%d', ${timeValue(first)})`, 'date');
		case 'weekday':
			return result(
				`((CAST(strftime('%w', ${timeValue(first)}) AS INTEGER) + 6) % 7 + 1)`,
				'number'
			);
		case 'date_add': {
			const unit = normalizeUnit(call.name, args[2].literal ?? '');
			const modifier = unit ? DATE_ADD_MODIFIERS[unit] : undefined;

			if (!modifier) {
				throw new FilterError('Unknown unit of `date_add()`');
			}

			// `'7 days'`, `'-1.5 days'`: the amount as text, then the unit.
			if (call.args[1].kind === 'number') {
				return result(`strftime(${ISO_FORMAT}, ${timeValue(first)}, ?)`, 'date', [
					...first.params,
					`${call.args[1].value * modifier.factor} ${modifier.unit}`
				]);
			}

			const amount = modifier.factor === 1 ? second.sql : `(${second.sql}) * ${modifier.factor}`;

			return result(
				`strftime(${ISO_FORMAT}, ${timeValue(first)}, CAST(${amount} AS TEXT) || ' ${modifier.unit}')`,
				'date',
				[...first.params, ...second.params]
			);
		}
		case 'start_of': {
			const unit = normalizeUnit(call.name, second.literal ?? '');
			const modifiers: Record<string, string> = {
				year: `'start of year'`,
				month: `'start of month'`,
				// Back to the Monday of the week (the day itself on a Monday).
				week: `'start of day', '-6 days', 'weekday 1'`,
				day: `'start of day'`
			};

			if (unit === 'hour') {
				return result(
					`strftime('%Y-%m-%dT%H:00:00.000Z', ${timeValue(first)})`,
					'date',
					first.params
				);
			}

			if (!unit || !modifiers[unit]) {
				throw new FilterError('Unknown unit of `start_of()`');
			}

			return result(
				`strftime(${ISO_FORMAT}, ${timeValue(first)}, ${modifiers[unit]})`,
				'date',
				first.params
			);
		}
	}

	throw new FilterError(`Unknown function \`${call.name}()\``);
}

function compileValue(value: FilterValue, scope: Scope): CompiledValue {
	const { context } = scope;

	switch (value.kind) {
		case 'field': {
			if (value.path) {
				return pathValue(value, scope);
			}

			const found = knownField(value.name, scope.fields);

			return { sql: column(scope, found.name), params: [], type: fieldType(found) };
		}
		case 'any':
			return anyValue(value, scope);
		case 'user':
			// Never `empty`: a signed-out user must not match records with an empty field.
			return parameter(context.user ? bindable(context.user[value.name]) : '');
		case 'input':
			return parameter(bindable(context.input?.[value.name]));
		case 'string':
			return {
				...parameter(value.value),
				empty: value.value === '',
				literal: value.value,
				millis: literalMillis(value.value)
			};
		case 'number':
			return parameter(value.value);
		case 'boolean':
			return { sql: value.value ? '1' : '0', params: [], type: 'other' };
		case 'null':
			return { sql: 'NULL', params: [], type: 'other', empty: true };
		case 'call':
			return compileCall(value, scope);
	}
}

/**
 * Compared with a Created or Updated field, a date (`now()`, `"2026-01-01"`, a Date field, a date
 * function) counts in milliseconds as well.
 */
function toMillis(value: CompiledValue, other: CompiledValue): CompiledValue {
	if (other.type !== 'millis' || value.type === 'millis') {
		return value;
	}

	if (value.millis !== undefined) {
		return { sql: '?', params: [value.millis], type: 'millis' };
	}

	if (value.type === 'date') {
		return {
			sql: `CAST(ROUND((julianday(${value.sql}) - 2440587.5) * 86400000) AS INTEGER)`,
			params: value.params,
			type: 'millis'
		};
	}

	return value;
}

function compare(
	operator: CompareOperator,
	leftValue: CompiledValue,
	rightValue: CompiledValue
): SqlCondition {
	const left = toMillis(leftValue, rightValue);
	const right = toMillis(rightValue, leftValue);
	const params = [...left.params, ...right.params];

	switch (operator) {
		case '==':
		case '!=': {
			// `""` and `null` both match an empty value.
			const sql = right.empty
				? `COALESCE(${left.sql}, '') = ''`
				: left.empty
					? `COALESCE(${right.sql}, '') = ''`
					: `${left.sql} IS ${right.sql}`;
			const used = right.empty ? left.params : left.empty ? right.params : params;

			return { sql: operator === '==' ? sql : `NOT (${sql})`, params: used };
		}
		default:
			return { sql: `${left.sql} ${operator} ${right.sql}`, params };
	}
}

function compileExpression(expression: FilterExpression, scope: Scope): SqlCondition {
	if (expression.kind === 'and' || expression.kind === 'or') {
		const left = compileExpression(expression.left, scope);
		const right = compileExpression(expression.right, scope);

		return {
			sql: `(${left.sql} ${expression.kind === 'and' ? 'AND' : 'OR'} ${right.sql})`,
			params: [...left.params, ...right.params]
		};
	}

	if (expression.kind === 'not') {
		const inner = compileExpression(expression.expression, scope);

		// Every record the condition doesn't match, also those it is unknown for (NULL).
		return { sql: `NOT COALESCE(${inner.sql}, 0)`, params: inner.params };
	}

	const predicate = expression as Extract<FilterExpression, { kind: 'compare' | 'call' }>;

	scope.any = undefined;

	const condition =
		predicate.kind === 'call'
			? compileCall(predicate, scope)
			: compare(
					predicate.operator,
					compileValue(predicate.left, scope),
					compileValue(predicate.right, scope)
				);
	// Set by `anyValue()` while the condition compiled.
	const source = scope.any as AnySource | undefined;

	scope.any = undefined;

	if (!source) {
		return { sql: condition.sql, params: condition.params };
	}

	return {
		sql: `EXISTS (SELECT 1 FROM ${source.from.join(', ')} WHERE ${[...source.where, `(${condition.sql})`].join(' AND ')})`,
		params: [...source.params, ...condition.params]
	};
}

function scopeOf(fields: FilterSchemaField[], context: FilterContext): Scope {
	return {
		fields: new Map(fields.map((candidate) => [candidate.name, candidate])),
		context,
		now: new Date(),
		aliases: { count: 0 },
		depth: 0
	};
}

/**
 * Compiles a filter expression for a collection with these fields.
 * @throws {FilterError} When the text isn't valid or refers to a field that doesn't exist.
 */
export function compileFilter(
	text: string,
	fields: FilterSchemaField[],
	context: FilterContext
): SqlCondition {
	return compileExpression(parseFilter(text), scopeOf(fields, context));
}

/**
 * Whether one of the conditions follows a relation (`author.role`), and so needs
 * `context.relations`; invalid conditions don't (compiling reports them).
 */
export function usesRelations(texts: (string | null | undefined)[]): boolean {
	return texts.some((text) => {
		if (!text?.trim()) {
			return false;
		}

		try {
			return filterValues(parseFilter(text)).some(
				(value) => (value.kind === 'field' || value.kind === 'any') && !!value.path
			);
		} catch {
			return false;
		}
	});
}

/**
 * The SQL condition of an API rule: `null` when the rule is locked, `ALWAYS` when it is empty.
 * @throws {FilterError} When the rule is invalid, e.g. after a field it uses was renamed.
 */
export function compileRule(
	rule: string | null | undefined,
	fields: FilterSchemaField[],
	context: FilterContext
): SqlCondition | null {
	if (rule === null || rule === undefined) {
		return null;
	}

	return rule.trim() ? compileFilter(rule, fields, context) : ALWAYS;
}

/** Both conditions. */
export function both(first: SqlCondition, second: SqlCondition): SqlCondition {
	if (first === ALWAYS) {
		return second;
	}

	if (second === ALWAYS) {
		return first;
	}

	return { sql: `(${first.sql}) AND (${second.sql})`, params: [...first.params, ...second.params] };
}

/** A value as SQLite holds a bound parameter. */
type SqlValue = string | number | null;

/** SQL's three-valued outcome: `null` is unknown (a comparison with NULL). */
type Truth = boolean | null;

/** A value in memory, with what `compileValue` would know of it. */
type EvaluatedValue = { value: SqlValue; type: ValueType; empty?: boolean; millis?: number };

/** Thrown inside `evaluateFilter` for what only SQLite can answer exactly. */
class Unsupported extends Error {}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** `bindable`, for values the evaluation can take as they are (SQLite would convert the others). */
function sqlValue(value: unknown): SqlValue {
	const bound = bindable(value);

	if (typeof bound === 'number' && !Number.isFinite(bound)) {
		throw new Unsupported();
	}

	if (typeof bound === 'string' && LONE_SURROGATE.test(bound)) {
		throw new Unsupported();
	}

	return bound;
}

function evaluated(value: SqlValue): EvaluatedValue {
	return { value, type: typeof value === 'number' ? 'number' : 'other' };
}

/** `compileValue`, in memory; `any()` is handled by the caller, function calls are left to SQL. */
function evaluateValue(
	value: FilterValue,
	scope: Scope,
	row: Record<string, unknown>
): EvaluatedValue {
	const { context } = scope;

	switch (value.kind) {
		case 'field': {
			const found = scope.fields.get(value.name);

			// Related records are only in the database.
			if (!found || found.type === 'blob' || value.path) {
				throw new Unsupported();
			}

			return { value: sqlValue(row[found.name]), type: fieldType(found) };
		}
		case 'user':
			return evaluated(context.user ? sqlValue(context.user[value.name]) : '');
		case 'input':
			return evaluated(sqlValue(context.input?.[value.name]));
		case 'string':
			return {
				...evaluated(sqlValue(value.value)),
				empty: value.value === '',
				millis: literalMillis(value.value)
			};
		case 'number':
			return evaluated(sqlValue(value.value));
		case 'boolean':
			return { value: value.value ? 1 : 0, type: 'other' };
		case 'null':
			return { value: null, type: 'other', empty: true };
		case 'call': {
			if (value.name !== 'now' && value.name !== 'today') {
				throw new Unsupported();
			}

			const { params, type, millis } = moment(value.name, scope.now);

			return { value: params[0], type, millis };
		}
		case 'any':
			throw new Unsupported();
	}
}

/** `toMillis`, in memory: only for values known in milliseconds up front. */
function evaluateMillis(value: EvaluatedValue, other: EvaluatedValue): EvaluatedValue {
	if (other.type !== 'millis' || value.type === 'millis') {
		return value;
	}

	if (value.millis !== undefined) {
		return { value: value.millis, type: 'millis' };
	}

	if (value.type === 'date') {
		throw new Unsupported();
	}

	return value;
}

/** SQLite's BINARY collation compares UTF-8 bytes, which is the order of the code points. */
function compareText(a: string, b: string) {
	let i = 0;
	let j = 0;

	while (i < a.length && j < b.length) {
		const x = a.codePointAt(i)!;
		const y = b.codePointAt(j)!;

		if (x !== y) {
			return x < y ? -1 : 1;
		}

		i += x > 0xffff ? 2 : 1;
		j += y > 0xffff ? 2 : 1;
	}

	return Number(i < a.length) - Number(j < b.length);
}

/** SQLite's order of two values without affinity: numbers before text. */
function compareValues(a: string | number, b: string | number) {
	if (typeof a === 'number' && typeof b === 'number') {
		return a < b ? -1 : a > b ? 1 : 0;
	}

	if (typeof a === 'number' || typeof b === 'number') {
		return typeof a === 'number' ? -1 : 1;
	}

	return compareText(a, b);
}

/** `compare` above, evaluated: `IS` for `==`, and NULL for an ordering with NULL. */
function evaluateCompare(
	operator: CompareOperator,
	leftValue: EvaluatedValue,
	rightValue: EvaluatedValue
): Truth {
	const { value: left, empty: leftEmpty } = evaluateMillis(leftValue, rightValue);
	const { value: right, empty: rightEmpty } = evaluateMillis(rightValue, leftValue);

	switch (operator) {
		case '==':
		case '!=': {
			const empty = rightEmpty ? left : leftEmpty ? right : undefined;
			const same =
				empty !== undefined
					? empty === null || empty === ''
					: left === null || right === null
						? left === right
						: typeof left === typeof right && left === right;

			return operator === '==' ? same : !same;
		}
		default: {
			if (left === null || right === null) {
				return null;
			}

			const order = compareValues(left, right);

			return operator === '>'
				? order > 0
				: operator === '>='
					? order >= 0
					: operator === '<'
						? order < 0
						: order <= 0;
		}
	}
}

/** The items `json_each` gives for a value of `any()`: a JSON array, or the value itself. */
function jsonItems(value: SqlValue): SqlValue[] {
	if (typeof value !== 'string') {
		return [value];
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(value);
	} catch {
		return [value];
	}

	if (!Array.isArray(parsed)) {
		return [value];
	}

	return parsed.map((item: unknown) => {
		if (item === null || typeof item === 'string') {
			return sqlValue(item);
		}

		if (typeof item === 'boolean') {
			return item ? 1 : 0;
		}

		// Integers beyond 2^53 are exact in SQLite but not in JavaScript; nested JSON comes back as
		// SQLite's own text of it.
		if (typeof item === 'number' && (!Number.isInteger(item) || Number.isSafeInteger(item))) {
			return sqlValue(item);
		}

		throw new Unsupported();
	});
}

function evaluateExpression(
	expression: FilterExpression,
	scope: Scope,
	row: Record<string, unknown>
): Truth {
	switch (expression.kind) {
		case 'and':
		case 'or': {
			const left = evaluateExpression(expression.left, scope, row);
			const right = evaluateExpression(expression.right, scope, row);

			if (expression.kind === 'and') {
				return left === false || right === false
					? false
					: left === null || right === null
						? null
						: true;
			}

			return left === true || right === true
				? true
				: left === null || right === null
					? null
					: false;
		}
		case 'not':
			// `NOT COALESCE(…, 0)`: unknown counts as false.
			return evaluateExpression(expression.expression, scope, row) !== true;
		case 'call':
			// The text functions follow SQLite's `lower()` and `LIKE`; those stay in SQL.
			throw new Unsupported();
	}

	const { operator, left, right } = expression;

	if (left.kind !== 'any' && right.kind !== 'any') {
		return evaluateCompare(
			operator,
			evaluateValue(left, scope, row),
			evaluateValue(right, scope, row)
		);
	}

	const name = left.kind === 'any' ? left.name : right.kind === 'any' ? right.name : '';
	const other = left.kind === 'any' ? right : left;
	const found = scope.fields.get(name);

	if ((left.kind === 'any' && left.path) || (right.kind === 'any' && right.path)) {
		throw new Unsupported();
	}

	if (!found || found.type === 'blob') {
		throw new Unsupported();
	}

	const otherValue = evaluateValue(other, scope, row);

	// `EXISTS (SELECT 1 FROM json_each(…) WHERE …)` is true or false, never NULL.
	return jsonItems(sqlValue(row[found.name])).some((item) => {
		const itemValue: EvaluatedValue = { value: item, type: 'other' };

		return (
			(left.kind === 'any'
				? evaluateCompare(operator, itemValue, otherValue)
				: evaluateCompare(operator, otherValue, itemValue)) === true
		);
	});
}

/**
 * Evaluates a condition on a row of values in memory, with the outcome SQLite gives for the
 * compiled condition on the same values as bound parameters (`SELECT 1 FROM (SELECT ? AS "field",
 * …) WHERE …`): `IS` for `==` and `!=`, unknown for an ordering with `null`, numbers before text
 * and text in code point order. Returns `undefined` for what is left to SQLite (functions other
 * than `now()` and `today()`, nested JSON in `any()`, values SQLite would convert), so the caller
 * runs the SQL instead.
 * @throws {FilterError} When the text isn't a valid condition.
 */
export function evaluateFilter(
	text: string,
	fields: FilterSchemaField[],
	context: FilterContext,
	row: Record<string, unknown>
): boolean | undefined {
	const expression = parseFilter(text);

	try {
		return evaluateExpression(expression, scopeOf(fields, context), row) === true;
	} catch (error) {
		if (error instanceof Unsupported) {
			return undefined;
		}

		throw error;
	}
}

/**
 * An `ORDER BY` list from `?order=`: field names separated by commas, each with `:asc` (the
 * default) or `:desc` (`created_at:desc,title`).
 * @throws {FilterError} For fields that don't exist or can't be sorted on.
 */
export function compileOrder(text: string, fields: FilterSchemaField[]): string[] {
	return text
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const [name, direction = 'asc', ...extra] = part.split(':').map((piece) => piece.trim());
			const field = fields.find((candidate) => candidate.name === name);

			if (extra.length || (direction !== 'asc' && direction !== 'desc')) {
				throw new FilterError(`\`${part}\` must be a field with \`:asc\` or \`:desc\``);
			}

			if (!field || field.type === 'blob') {
				throw new FilterError(`Can't order by \`${name}\``);
			}

			return `"${field.name}" ${direction === 'desc' ? 'DESC' : 'ASC'}`;
		});
}
