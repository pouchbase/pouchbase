import type { FilterFunctionArgument, FilterFunctionName } from './functions';

import { FILTER_FUNCTIONS, functionSignature, isFilterFunction, normalizeUnit } from './functions';

/**
 * Conditions, used by `?where=` of the records API and by the API rules of a collection:
 *
 * ```
 * status == "published" && (views > 10 || author == $user.id) && !contains(title, "draft")
 * ```
 *
 * - Values: field names, `"strings"` or `'strings'`, numbers, `true`, `false`, `null`,
 *   `$user.<field>` (the signed-in user; empty when signed out), `$input.<field>` (the submitted
 *   value, for create and update rules) and calls of the functions in `functions.ts`, such as
 *   `lower(title)`, `now()` or `date_add(now(), -7, "days")`.
 * - Comparisons: `==`, `!=`, `>`, `>=`, `<` and `<=` between two values.
 * - Conditions: a comparison, or a call of a function that gives a boolean, such as
 *   `contains(title, "svelte")`.
 * - `<relation>.<field>`: a field of the related record (`author.role`, `post.author.name`), up
 *   to `MAX_RELATION_DEPTH` relations deep; empty when the relation is.
 * - `any(<field>)` as a value: the condition is true when it holds for any item of a multiple
 *   relation or list, or of a path through one (`any(editors) == $user.id`,
 *   `contains(any(tags), "news")`, `any(editors.role) == "admin"`).
 * - `&&` or `AND`, `||` or `OR`, `!` or `NOT`, and parentheses; `#` starts a comment until the
 *   end of the line. The words are uppercase, so they never look like field names.
 *
 * Shared between the client (validating rules in forms) and the server, which compiles the parsed
 * expression to SQL (`src/lib/server/filter.ts`).
 */

export const COMPARE_OPERATORS = ['==', '!=', '>', '>=', '<', '<='] as const;

export type CompareOperator = (typeof COMPARE_OPERATORS)[number];

/** A call of a function from `functions.ts`. */
export type FilterCall = {
	kind: 'call';
	name: FilterFunctionName;
	args: FilterValue[];
	position: number;
};

/**
 * A field of the collection (`name`), or with `path` a field of a related record: `author.role`
 * is `{ name: 'author', path: ['role'] }`. `position`: where the name starts in the text, for
 * error messages in the editor.
 */
export type FilterField = { name: string; path?: string[]; position: number };

export type FilterValue =
	| ({ kind: 'field' } & FilterField)
	| { kind: 'user'; name: string; position: number }
	| { kind: 'input'; name: string; position: number }
	/** `any(<field>)`: each item of the field, or of the path, in turn. */
	| ({ kind: 'any' } & FilterField)
	| { kind: 'string'; value: string }
	| { kind: 'number'; value: number }
	| { kind: 'boolean'; value: boolean }
	| { kind: 'null' }
	| FilterCall;

export type FilterExpression =
	| { kind: 'and' | 'or'; left: FilterExpression; right: FilterExpression }
	| { kind: 'not'; expression: FilterExpression }
	| { kind: 'compare'; operator: CompareOperator; left: FilterValue; right: FilterValue }
	/** A function that gives a boolean, as a condition of its own. */
	| FilterCall;

/** Longest condition or rule, in characters. */
export const MAX_FILTER_LENGTH = 3500;
/** Most comparisons in one expression; keeps the SQL within D1's limit of bound parameters. */
export const MAX_COMPARISONS = 30;
/** Most function calls in one expression, for the same reason. */
export const MAX_FUNCTION_CALLS = 30;
/** Most relations a path goes through: `post.author.team.name` is three. */
export const MAX_RELATION_DEPTH = 3;

const NAME = /^[a-z][a-z0-9_]{0,62}$/;

/** The words that combine and negate conditions, next to `&&`, `||` and `!`. */
const LOGICAL_WORDS = { AND: 'and', OR: 'or', NOT: 'not' } as const;

/** What to write instead of a lowercase `and`, `or` or `not`. */
const LOWERCASE_HINTS: Record<string, string> = {
	and: 'Use `&&` or `AND` to combine conditions',
	or: 'Use `||` or `OR` to combine conditions',
	not: 'Use `!` or `NOT` to negate a condition'
};

/** A condition that can't be parsed; `position` is the offset in the text where it went wrong. */
export class FilterError extends Error {
	override name = 'FilterError';
	readonly position: number;

	constructor(message: string, position = 0) {
		super(message);
		this.position = position;
	}
}

type Token =
	| { type: 'string'; value: string; position: number }
	| { type: 'number'; value: number; position: number }
	| { type: 'identifier'; value: string; position: number }
	| { type: 'operator'; value: CompareOperator; position: number }
	| { type: 'and' | 'or' | 'not' | '(' | ')' | ','; position: number };

function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	let index = 0;

	while (index < text.length) {
		const char = text[index];
		const position = index;
		const rest = text.slice(index);

		if (/\s/.test(char)) {
			index++;
			continue;
		}

		if (char === '#') {
			const end = text.indexOf('\n', index);
			index = end === -1 ? text.length : end;
			continue;
		}

		if (char === '(' || char === ')' || char === ',') {
			tokens.push({ type: char, position });
			index++;
			continue;
		}

		if (rest.startsWith('&&') || rest.startsWith('||')) {
			tokens.push({ type: char === '&' ? 'and' : 'or', position });
			index += 2;
			continue;
		}

		if (char === '&' || char === '|') {
			throw new FilterError(`Use \`${char}${char}\` to combine conditions`, position);
		}

		if (char === '"' || char === "'") {
			let value = '';

			index++;

			while (index < text.length && text[index] !== char) {
				if (text[index] === '\\' && index + 1 < text.length) {
					index++;
				}

				value += text[index];
				index++;
			}

			if (index >= text.length) {
				throw new FilterError('Unterminated string', position);
			}

			index++;
			tokens.push({ type: 'string', value, position });
			continue;
		}

		const number = /^-?\d+(\.\d+)?/.exec(rest);

		if (number) {
			tokens.push({ type: 'number', value: Number(number[0]), position });
			index += number[0].length;
			continue;
		}

		const operator = /^(==|!=|>=|<=|>|<)/.exec(rest);

		if (operator) {
			tokens.push({ type: 'operator', value: operator[0] as CompareOperator, position });
			index += operator[0].length;
			continue;
		}

		if (char === '=') {
			throw new FilterError('Use `==` to compare', position);
		}

		// After `!=`, so this is `!` on its own.
		if (char === '!') {
			tokens.push({ type: 'not', position });
			index++;
			continue;
		}

		const word = /^\$?[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);

		if (word) {
			const value = word[0];

			if (Object.hasOwn(LOGICAL_WORDS, value)) {
				tokens.push({ type: LOGICAL_WORDS[value as keyof typeof LOGICAL_WORDS], position });
			} else if (Object.hasOwn(LOWERCASE_HINTS, value)) {
				throw new FilterError(LOWERCASE_HINTS[value], position);
			} else {
				tokens.push({ type: 'identifier', value, position });
			}

			index += value.length;
			continue;
		}

		throw new FilterError(`Unexpected character \`${char}\``, position);
	}

	return tokens;
}

function identifierValue(value: string, position: number): FilterValue {
	switch (value) {
		case 'true':
		case 'false':
			return { kind: 'boolean', value: value === 'true' };
		case 'null':
			return { kind: 'null' };
		case '$now':
			throw new FilterError('Use `now()` for the current date and time', position);
	}

	const variable = /^\$(user|input)\.(.+)$/.exec(value);

	if (variable) {
		if (!NAME.test(variable[2])) {
			throw new FilterError(`\`${variable[2]}\` is not a field name`, position);
		}

		return { kind: variable[1] as 'user' | 'input', name: variable[2], position };
	}

	if (value.startsWith('$')) {
		throw new FilterError(
			`Unknown variable \`${value}\`; use $user.<field> or $input.<field>`,
			position
		);
	}

	const [name, ...path] = value.split('.');
	let offset = position;

	for (const part of [name, ...path]) {
		if (!NAME.test(part)) {
			throw new FilterError(`\`${part}\` is not a field name`, offset);
		}

		offset += part.length + 1;
	}

	if (path.length > MAX_RELATION_DEPTH) {
		throw new FilterError(
			`Go at most ${MAX_RELATION_DEPTH} relations deep (\`${value}\`)`,
			position
		);
	}

	return path.length ? { kind: 'field', name, path, position } : { kind: 'field', name, position };
}

/**
 * Parses a condition.
 * @throws {FilterError} When the text isn't a valid condition.
 */
export function parseFilter(text: string): FilterExpression {
	if (text.length > MAX_FILTER_LENGTH) {
		throw new FilterError(`Use at most ${MAX_FILTER_LENGTH} characters`);
	}

	const tokens = tokenize(text);
	let index = 0;
	let comparisons = 0;
	let calls = 0;
	// Whether the condition being parsed already has an `any()`: one per comparison or call.
	let hasAny = false;

	const peek = (offset = 0) => tokens[index + offset];
	const end = () => (tokens.at(-1)?.position ?? 0) + 1;

	function expect(type: '(' | ')', message: string) {
		if (peek()?.type !== type) {
			throw new FilterError(message, peek()?.position ?? end());
		}

		index++;
	}

	/** Counts a comparison or a condition that is a call. */
	function countComparison(position: number) {
		if (++comparisons > MAX_COMPARISONS) {
			throw new FilterError(`Use at most ${MAX_COMPARISONS} comparisons`, position);
		}
	}

	/** `name(…)`, with the identifier token at `index`. */
	function call(): FilterCall | FilterValue {
		const token = tokens[index] as Extract<Token, { type: 'identifier' }>;
		const name = token.value;

		index++;
		expect('(', `Expected \`(\` after \`${name}\``);

		if (name === 'any') {
			const field = peek();

			if (hasAny) {
				throw new FilterError('Use `any()` once per comparison', token.position);
			}

			if (field?.type !== 'identifier' || peek(1)?.type === '(') {
				throw new FilterError('`any()` takes a field of this collection', token.position);
			}

			const value = identifierValue(field.value, field.position);

			if (value.kind !== 'field') {
				throw new FilterError('`any()` takes a field of this collection', token.position);
			}

			index++;
			expect(')', 'Missing `)`');
			hasAny = true;

			return { ...value, kind: 'any' };
		}

		if (!isFilterFunction(name)) {
			throw new FilterError(`Unknown function \`${name}()\``, token.position);
		}

		if (++calls > MAX_FUNCTION_CALLS) {
			throw new FilterError(`Use at most ${MAX_FUNCTION_CALLS} function calls`, token.position);
		}

		const args: FilterValue[] = [];

		if (peek()?.type !== ')') {
			args.push(value());

			while (peek()?.type === ',') {
				index++;
				args.push(value());
			}
		}

		expect(')', 'Missing `)`');

		const spec: readonly FilterFunctionArgument[] = FILTER_FUNCTIONS[name].args;
		const required = spec.filter((arg) => !arg.optional).length;

		if (args.length < required || args.length > spec.length) {
			throw new FilterError(`Call it as \`${functionSignature(name)}\``, token.position);
		}

		spec.forEach((arg, position) => {
			const given = args[position];

			if (!arg.units || !given) {
				return;
			}

			if (given.kind !== 'string' || !normalizeUnit(name, given.value)) {
				const units = arg.units.map((unit) => `"${unit}"`).join(', ');

				throw new FilterError(
					`The ${arg.name} of \`${name}()\` is one of ${units}`,
					token.position
				);
			}
		});

		return { kind: 'call', name, args, position: token.position };
	}

	function value(): FilterValue {
		const token = peek();

		if (!token) {
			throw new FilterError('Expected a value at the end', end());
		}

		switch (token.type) {
			case 'string':
				index++;
				return { kind: 'string', value: token.value };
			case 'number':
				index++;
				return { kind: 'number', value: token.value };
			case 'identifier': {
				if (peek(1)?.type !== '(') {
					index++;
					return identifierValue(token.value, token.position);
				}

				const result = call();

				if (result.kind === 'call' && FILTER_FUNCTIONS[result.name].returns === 'boolean') {
					throw new FilterError(
						`\`${result.name}()\` is a condition of its own; use \`!\` to negate it`,
						token.position
					);
				}

				return result;
			}
			default:
				throw new FilterError('Expected a field or a value', token.position);
		}
	}

	function primary(): FilterExpression {
		const token = peek();

		if (token?.type === '(') {
			index++;

			const inner = or();

			expect(')', 'Missing `)`');
			return inner;
		}

		hasAny = false;

		if (
			token?.type === 'identifier' &&
			peek(1)?.type === '(' &&
			isFilterFunction(token.value) &&
			FILTER_FUNCTIONS[token.value].returns === 'boolean'
		) {
			countComparison(token.position);

			const predicate = call() as FilterCall;

			if (peek()?.type === 'operator') {
				throw new FilterError(
					`\`${predicate.name}()\` is a condition of its own; use \`!\` to negate it`,
					peek()?.position
				);
			}

			return predicate;
		}

		const left = value();
		const operator = tokens[index++];

		if (operator?.type === 'operator') {
			countComparison(operator.position);
			return { kind: 'compare', operator: operator.value, left, right: value() };
		}

		if (
			(operator?.type === 'identifier' && operator.value === 'contains') ||
			(operator?.type === 'not' && peek()?.type === 'identifier')
		) {
			throw new FilterError(
				'Use `contains(text, search)` or `!contains(text, search)`',
				operator.position
			);
		}

		if (left.kind === 'call') {
			throw new FilterError(
				`Compare \`${left.name}()\` with a value, e.g. \`${FILTER_FUNCTIONS[left.name].example}\``,
				operator?.position ?? end()
			);
		}

		throw new FilterError(
			'Expected a comparison such as ==, !=, > or <',
			operator?.position ?? end()
		);
	}

	function unary(): FilterExpression {
		if (peek()?.type === 'not') {
			index++;
			return { kind: 'not', expression: unary() };
		}

		return primary();
	}

	function and(): FilterExpression {
		let left = unary();

		while (peek()?.type === 'and') {
			index++;
			left = { kind: 'and', left, right: unary() };
		}

		return left;
	}

	function or(): FilterExpression {
		let left = and();

		while (peek()?.type === 'or') {
			index++;
			left = { kind: 'or', left, right: and() };
		}

		return left;
	}

	if (!tokens.length) {
		throw new FilterError('The condition is empty');
	}

	const expression = or();
	const rest = peek();

	if (rest) {
		throw new FilterError('Expected `&&` or `||` between conditions', rest.position);
	}

	return expression;
}

/** Every value an expression uses, including the arguments of function calls. */
export function filterValues(expression: FilterExpression): FilterValue[] {
	const values = (value: FilterValue): FilterValue[] =>
		value.kind === 'call' ? value.args.flatMap(values) : [value];

	switch (expression.kind) {
		case 'and':
		case 'or':
			return [...filterValues(expression.left), ...filterValues(expression.right)];
		case 'not':
			return filterValues(expression.expression);
		case 'compare':
			return [...values(expression.left), ...values(expression.right)];
		case 'call':
			return expression.args.flatMap(values);
	}
}

/** Names of the collection's fields an expression reads (not those of `$user` or `$input`). */
export function filterFields(expression: FilterExpression): string[] {
	return [
		...new Set(
			filterValues(expression).flatMap((value) =>
				value.kind === 'field' || value.kind === 'any' ? [value.name] : []
			)
		)
	];
}

/** A problem in a condition, with the part of the text it is about (offsets, `end` exclusive). */
export type FilterProblem = { message: string; start: number; end: number };

/** The end of the word (name, number, string or operator) that starts at `start`. */
function wordEnd(text: string, start: number) {
	const match = /^(\$?[\w.]+|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|[^\s\w]+)/.exec(
		text.slice(start)
	);

	return start + Math.max(match?.[0].length ?? 1, 1);
}

/** What `checkFilter` knows of a relation field: the collection it points to and its fields. */
export type FilterRelation = { collection: string; fields: string[]; multiple: boolean };

/** What `checkFilter` checks the names of a condition against. */
export type FilterNames = {
	fields: string[];
	/** The fields of `users`; `$user.*` isn't checked without them. */
	userFields?: string[];
	/**
	 * The relation at a path of field names (`['author']`, `['post', 'author']`), or `null` when
	 * the last one isn't a relation. Paths (`author.role`) aren't checked past the first name
	 * without it.
	 */
	relation?: (path: string[]) => FilterRelation | null;
};

/**
 * The problem with a path through relations (`post.author.role`), if any: each name but the last
 * must be a relation, the next name a field of the collection it points to, and a relation to
 * several records needs `any()`.
 */
function pathProblem(
	text: string,
	value: FilterField & { kind: 'field' | 'any' },
	relation: NonNullable<FilterNames['relation']>
): FilterProblem | null {
	const names = [value.name, ...(value.path ?? [])];
	let start = value.position;

	for (let index = 1; index < names.length; index++) {
		const hop = names.slice(0, index);
		const info = relation(hop);
		const name = names[index];
		const at = (message: string, position: number) => ({
			message,
			start: position,
			end: position + (position === start ? hop.at(-1)!.length : name.length)
		});

		if (!info) {
			return at(`\`${hop.at(-1)}\` is not a relation`, start);
		}

		if (info.multiple && value.kind === 'field') {
			return at(`\`${hop.at(-1)}\` holds several records; use \`any(${names.join('.')})\``, start);
		}

		const next = start + hop.at(-1)!.length + 1;

		if (!info.fields.includes(name)) {
			return at(`\`${name}\` is not a field of ${info.collection}`, next);
		}

		start = next;
	}

	return null;
}

/**
 * Checks a condition as the server will: its syntax, and that the fields it uses exist. Returns
 * the first problem, or `null` when the condition is valid.
 */
export function checkFilter(text: string, names: FilterNames): FilterProblem | null {
	let expression: FilterExpression;

	try {
		expression = parseFilter(text);
	} catch (error) {
		if (!(error instanceof FilterError)) {
			throw error;
		}

		const start = Math.min(error.position, Math.max(text.length - 1, 0));

		return { message: error.message, start, end: wordEnd(text, start) };
	}

	for (const value of filterValues(expression)) {
		if (
			value.kind !== 'field' &&
			value.kind !== 'any' &&
			value.kind !== 'user' &&
			value.kind !== 'input'
		) {
			continue;
		}

		const known =
			value.kind === 'user'
				? !names.userFields || names.userFields.includes(value.name)
				: names.fields.includes(value.name);

		if (!known) {
			const owner = value.kind === 'user' ? 'users' : 'this collection';

			return {
				message: `\`${value.name}\` is not a field of ${owner}`,
				start: value.position,
				end: value.position + value.name.length
			};
		}

		if ((value.kind === 'field' || value.kind === 'any') && value.path && names.relation) {
			const problem = pathProblem(text, value, names.relation);

			if (problem) {
				return problem;
			}
		}
	}

	return null;
}
