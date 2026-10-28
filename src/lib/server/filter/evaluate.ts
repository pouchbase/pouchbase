import type { CompareOperator, FilterExpression, FilterValue } from '#lib/filter/filter.js';
import type { FilterContext, FilterSchemaField, Scope, ValueType } from './compile';

import { parseFilter } from '#lib/filter/filter.js';

import { bindable, fieldType, literalMillis, moment, scopeOf } from './compile';

/**
 * Evaluates a filter expression in memory, on a row of values, with the answer SQLite would give
 * for the compiled condition (see `compile.ts`); the realtime hubs use it so an event costs no
 * query. `undefined` when only SQLite can answer exactly.
 */

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
