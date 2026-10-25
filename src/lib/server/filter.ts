import type { CompareOperator, FilterExpression, Operand } from '#lib/filter/filter.js';
import type { Field } from './services/fields.service';

import { FilterError, parseFilter } from '#lib/filter/filter.js';

/**
 * Compiles filter expressions (`#lib/filter/filter.ts`) to a SQL condition with bound parameters,
 * for `?where=` and the API rules of the records API. Throws a `FilterError` for unknown fields.
 *
 * Field names are checked against the collection's fields before they end up in the SQL, and
 * every value is a bound parameter, so a filter can never inject SQL.
 */

export type SqlCondition = { sql: string; params: (string | number | null)[] };

/** What `$user` and `$input` refer to while the condition runs. */
export type FilterContext = {
	/** The signed-in user (a row of `users`), or `null`; every `$user.*` is `""` then. */
	user: Record<string, unknown> | null;
	/** The submitted fields, for create and update rules. */
	input?: Record<string, unknown>;
};

type CompiledOperand = SqlCondition & {
	field?: Pick<Field, 'name' | 'type'>;
	/** The literal `""` or `null`. */
	empty?: boolean;
};

/** The same condition for every record. */
export const ALWAYS: SqlCondition = { sql: '1', params: [] };

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

function compileOperand(
	operand: Operand,
	fields: Map<string, Pick<Field, 'name' | 'type'>>,
	context: FilterContext,
	other: Operand
): CompiledOperand {
	switch (operand.kind) {
		case 'field': {
			const field = fields.get(operand.name);

			if (!field || field.type === 'blob') {
				throw new FilterError(`Unknown field \`${operand.name}\``);
			}

			return { sql: `"${field.name}"`, params: [], field };
		}
		case 'user': {
			// Never `empty`: a signed-out user must not match records with an empty field.
			return { sql: '?', params: [context.user ? bindable(context.user[operand.name]) : ''] };
		}
		case 'input':
			return { sql: '?', params: [bindable(context.input?.[operand.name])] };
		case 'string':
			return { sql: '?', params: [operand.value], empty: operand.value === '' };
		case 'number':
			return { sql: '?', params: [operand.value] };
		case 'boolean':
			return { sql: operand.value ? '1' : '0', params: [] };
		case 'null':
			return { sql: 'NULL', params: [], empty: true };
		case 'now': {
			// `created` and `updated` fields hold milliseconds; dates are ISO 8601 text.
			const type = other.kind === 'field' ? fields.get(other.name)?.type : undefined;
			const now = new Date();

			return {
				sql: '?',
				params: [type === 'created' || type === 'updated' ? now.getTime() : now.toISOString()]
			};
		}
	}
}

/** A `LIKE` pattern: a literal string without `%` matches anywhere in the value. */
function likePattern(right: Operand, compiled: CompiledOperand): CompiledOperand {
	if (right.kind === 'string' && !right.value.includes('%')) {
		return { sql: '?', params: [`%${right.value}%`] };
	}

	if (right.kind === 'string') {
		return compiled;
	}

	return { sql: `'%' || ${compiled.sql} || '%'`, params: compiled.params };
}

function compare(
	operator: string,
	left: CompiledOperand,
	right: CompiledOperand,
	rightOperand: Operand
): SqlCondition {
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
		case 'contains':
		case 'not contains': {
			const pattern = likePattern(rightOperand, right);
			const sql = `COALESCE(${left.sql}, '') LIKE ${pattern.sql}`;

			return {
				sql: operator === 'contains' ? sql : `NOT (${sql})`,
				params: [...left.params, ...pattern.params]
			};
		}
		default:
			return { sql: `${left.sql} ${operator} ${right.sql}`, params };
	}
}

function compileExpression(
	expression: FilterExpression,
	fields: Map<string, Pick<Field, 'name' | 'type'>>,
	context: FilterContext
): SqlCondition {
	if (expression.kind !== 'compare') {
		const left = compileExpression(expression.left, fields, context);
		const right = compileExpression(expression.right, fields, context);

		return {
			sql: `(${left.sql} ${expression.kind === 'and' ? 'AND' : 'OR'} ${right.sql})`,
			params: [...left.params, ...right.params]
		};
	}

	const { operator, any, left: leftOperand, right: rightOperand } = expression;
	const left = compileOperand(leftOperand, fields, context, rightOperand);
	const right = compileOperand(rightOperand, fields, context, leftOperand);

	if (!any) {
		return compare(operator, left, right, rightOperand);
	}

	if (!left.field) {
		throw new FilterError('`any()` takes a field of this collection');
	}

	// Any item of a JSON array (multiple relations and lists); a single value counts as one item.
	const items = `CASE WHEN json_valid(${left.sql}) AND json_type(${left.sql}) = 'array' THEN ${left.sql} ELSE json_array(${left.sql}) END`;
	const condition = compare(operator, { sql: '"value"', params: [] }, right, rightOperand);

	return {
		sql: `EXISTS (SELECT 1 FROM json_each(${items}) WHERE ${condition.sql})`,
		params: condition.params
	};
}

/**
 * Compiles a filter expression for a collection with these fields.
 * @throws {FilterError} When the text isn't valid or refers to a field that doesn't exist.
 */
export function compileFilter(
	text: string,
	fields: Pick<Field, 'name' | 'type'>[],
	context: FilterContext
): SqlCondition {
	return compileExpression(
		parseFilter(text),
		new Map(fields.map((field) => [field.name, field])),
		context
	);
}

/**
 * The SQL condition of an API rule: `null` when the rule is locked, `ALWAYS` when it is empty.
 * @throws {FilterError} When the rule is invalid, e.g. after a field it uses was renamed.
 */
export function compileRule(
	rule: string | null | undefined,
	fields: Pick<Field, 'name' | 'type'>[],
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

function isEmptyLiteral(operand: Operand) {
	return operand.kind === 'null' || (operand.kind === 'string' && operand.value === '');
}

function evaluateOperand(
	operand: Operand,
	fields: Map<string, Pick<Field, 'name' | 'type'>>,
	context: FilterContext,
	row: Record<string, unknown>,
	other: Operand
): SqlValue {
	switch (operand.kind) {
		case 'field': {
			const field = fields.get(operand.name);

			if (!field || field.type === 'blob') {
				throw new Unsupported();
			}

			return sqlValue(row[field.name]);
		}
		case 'user':
			return context.user ? sqlValue(context.user[operand.name]) : '';
		case 'input':
			return sqlValue(context.input?.[operand.name]);
		case 'string':
			return sqlValue(operand.value);
		case 'number':
			return sqlValue(operand.value);
		case 'boolean':
			return operand.value ? 1 : 0;
		case 'null':
			return null;
		case 'now': {
			const type = other.kind === 'field' ? fields.get(other.name)?.type : undefined;
			const now = new Date();

			return type === 'created' || type === 'updated' ? now.getTime() : now.toISOString();
		}
	}
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
	left: SqlValue,
	leftEmpty: boolean,
	right: SqlValue,
	rightEmpty: boolean
): Truth {
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
		case 'contains':
		case 'not contains':
			// LIKE (case-insensitive for ASCII only, `%` and `_` as wildcards) stays in SQL.
			throw new Unsupported();
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
	fields: Map<string, Pick<Field, 'name' | 'type'>>,
	context: FilterContext,
	row: Record<string, unknown>
): Truth {
	if (expression.kind !== 'compare') {
		const left = evaluateExpression(expression.left, fields, context, row);
		const right = evaluateExpression(expression.right, fields, context, row);

		if (expression.kind === 'and') {
			return left === false || right === false
				? false
				: left === null || right === null
					? null
					: true;
		}

		return left === true || right === true ? true : left === null || right === null ? null : false;
	}

	const { operator, any, left: leftOperand, right: rightOperand } = expression;
	const left = evaluateOperand(leftOperand, fields, context, row, rightOperand);
	const right = evaluateOperand(rightOperand, fields, context, row, leftOperand);
	const rightEmpty = isEmptyLiteral(rightOperand);

	if (!any) {
		return evaluateCompare(operator, left, isEmptyLiteral(leftOperand), right, rightEmpty);
	}

	if (leftOperand.kind !== 'field') {
		throw new Unsupported();
	}

	// `EXISTS (SELECT 1 FROM json_each(…) WHERE …)` is true or false, never NULL.
	return jsonItems(left).some(
		(item) => evaluateCompare(operator, item, false, right, rightEmpty) === true
	);
}

/**
 * Evaluates a condition on a row of values in memory, with the outcome SQLite gives for the
 * compiled condition on the same values as bound parameters (`SELECT 1 FROM (SELECT ? AS "field",
 * …) WHERE …`): `IS` for `==` and `!=`, unknown for an ordering with `null`, numbers before text
 * and text in code point order. Returns `undefined` for what is left to SQLite (`contains`, nested
 * JSON in `any()`, values SQLite would convert), so the caller runs the SQL instead.
 * @throws {FilterError} When the text isn't a valid condition.
 */
export function evaluateFilter(
	text: string,
	fields: Pick<Field, 'name' | 'type'>[],
	context: FilterContext,
	row: Record<string, unknown>
): boolean | undefined {
	const expression = parseFilter(text);

	try {
		return (
			evaluateExpression(
				expression,
				new Map(fields.map((field) => [field.name, field])),
				context,
				row
			) === true
		);
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
export function compileOrder(text: string, fields: Pick<Field, 'name' | 'type'>[]): string[] {
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
