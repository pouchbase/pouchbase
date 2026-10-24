/**
 * Conditions, used by `?where=` of the records API and by the API rules of a collection:
 *
 * ```
 * status == "published" and (views > 10 or author == $user.id)
 * ```
 *
 * - Operands: field names, `"strings"` or `'strings'`, numbers, `true`, `false`, `null`, `$now`,
 *   `$user.<field>` (the signed-in user; empty when signed out) and `$input.<field>` (the
 *   submitted value, for create and update rules).
 * - Comparisons: `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains` and `not contains` (case-insensitive;
 *   `%` in a literal is a wildcard).
 * - `any(<field>) <comparison> <value>`: true when any item of a multiple relation or list matches.
 * - `and`, `or` and parentheses; `#` starts a comment until the end of the line.
 *
 * Shared between the client (validating rules in forms) and the server, which compiles the parsed
 * expression to SQL (`src/lib/server/filter.ts`).
 */

export const COMPARE_OPERATORS = [
	'==',
	'!=',
	'>',
	'>=',
	'<',
	'<=',
	'contains',
	'not contains'
] as const;

export type CompareOperator = (typeof COMPARE_OPERATORS)[number];

export type Operand =
	// `position`: where the name starts in the text, for error messages in the editor.
	| { kind: 'field'; name: string; position: number }
	| { kind: 'user'; name: string; position: number }
	| { kind: 'input'; name: string; position: number }
	| { kind: 'string'; value: string }
	| { kind: 'number'; value: number }
	| { kind: 'boolean'; value: boolean }
	| { kind: 'null' }
	| { kind: 'now' };

export type FilterExpression =
	| { kind: 'and' | 'or'; left: FilterExpression; right: FilterExpression }
	| {
			kind: 'compare';
			operator: CompareOperator;
			/** `any(field) …`: true when any item of the left (multiple) value matches. */
			any: boolean;
			left: Operand;
			right: Operand;
	  };

/** Longest condition or rule, in characters. */
export const MAX_FILTER_LENGTH = 3500;
/** Most comparisons in one expression; keeps the SQL within D1's limit of bound parameters. */
export const MAX_COMPARISONS = 30;

const NAME = /^[a-z][a-z0-9_]{0,62}$/;

/** Words with a meaning of their own, so they can't be field names in a condition. */
export const KEYWORDS = ['and', 'or', 'not', 'any', 'contains'] as const;

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
	| { type: 'and' | 'or' | 'any' | '(' | ')'; position: number };

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

		if (char === '(' || char === ')') {
			tokens.push({ type: char, position });
			index++;
			continue;
		}

		if (rest.startsWith('&&') || rest.startsWith('||')) {
			throw new FilterError(
				`Use \`${char === '&' ? 'and' : 'or'}\` to combine conditions`,
				position
			);
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

		const notContains = /^not\s+contains\b/.exec(rest);

		if (notContains) {
			tokens.push({ type: 'operator', value: 'not contains', position });
			index += notContains[0].length;
			continue;
		}

		const word = /^\$?[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);

		if (word) {
			const value = word[0];

			if (value === 'contains') {
				tokens.push({ type: 'operator', value, position });
			} else if (value === 'and' || value === 'or' || value === 'any') {
				tokens.push({ type: value, position });
			} else if (value === 'not') {
				throw new FilterError('Use `!=` or `not contains`', position);
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

function identifierOperand(value: string, position: number): Operand {
	switch (value) {
		case 'true':
		case 'false':
			return { kind: 'boolean', value: value === 'true' };
		case 'null':
			return { kind: 'null' };
		case '$now':
			return { kind: 'now' };
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
			`Unknown variable \`${value}\`; use $now, $user.<field> or $input.<field>`,
			position
		);
	}

	if (value.includes('.')) {
		throw new FilterError(`Fields of related records (\`${value}\`) aren't supported`, position);
	}

	if (!NAME.test(value)) {
		throw new FilterError(`\`${value}\` is not a field name`, position);
	}

	return { kind: 'field', name: value, position };
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

	const peek = () => tokens[index];
	const end = () => (tokens.at(-1)?.position ?? 0) + 1;

	function expect(type: '(' | ')', message: string) {
		if (peek()?.type !== type) {
			throw new FilterError(message, peek()?.position ?? end());
		}

		index++;
	}

	function operand(): Operand {
		const token = tokens[index++];

		if (!token) {
			throw new FilterError('Expected a value at the end', end());
		}

		switch (token.type) {
			case 'string':
				return { kind: 'string', value: token.value };
			case 'number':
				return { kind: 'number', value: token.value };
			case 'identifier':
				return identifierOperand(token.value, token.position);
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

		const any = token?.type === 'any';

		if (any) {
			index++;
			expect('(', 'Expected `(` after `any`');
		}

		const left = operand();

		if (any) {
			if (left.kind !== 'field') {
				throw new FilterError('`any()` takes a field of this collection', token.position);
			}

			expect(')', 'Missing `)`');
		}

		const operator = tokens[index++];

		if (operator?.type !== 'operator') {
			throw new FilterError(
				'Expected a comparison such as ==, !=, >, < or contains',
				operator?.position ?? end()
			);
		}

		if (++comparisons > MAX_COMPARISONS) {
			throw new FilterError(`Use at most ${MAX_COMPARISONS} comparisons`, operator.position);
		}

		return { kind: 'compare', operator: operator.value, any, left, right: operand() };
	}

	function and(): FilterExpression {
		let left = primary();

		while (peek()?.type === 'and') {
			index++;
			left = { kind: 'and', left, right: primary() };
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
		throw new FilterError('Expected `and` or `or` between conditions', rest.position);
	}

	return expression;
}

/** Names of the collection's fields an expression reads (not those of `$user` or `$input`). */
export function filterFields(expression: FilterExpression): string[] {
	if (expression.kind !== 'compare') {
		return [...new Set([...filterFields(expression.left), ...filterFields(expression.right)])];
	}

	return [expression.left, expression.right].flatMap((operand) =>
		operand.kind === 'field' ? [operand.name] : []
	);
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

/**
 * Checks a condition as the server will: its syntax, and that the fields it uses exist. Fields of
 * the signed-in user (`$user.*`) are only checked when `userFields` is given. Returns the first
 * problem, or `null` when the condition is valid.
 */
export function checkFilter(
	text: string,
	names: { fields: string[]; userFields?: string[] }
): FilterProblem | null {
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

	const operands = (node: FilterExpression): Operand[] =>
		node.kind === 'compare'
			? [node.left, node.right]
			: [...operands(node.left), ...operands(node.right)];

	for (const operand of operands(expression)) {
		if (operand.kind !== 'field' && operand.kind !== 'user' && operand.kind !== 'input') {
			continue;
		}

		const known =
			operand.kind === 'user'
				? !names.userFields || names.userFields.includes(operand.name)
				: names.fields.includes(operand.name);

		if (!known) {
			const owner = operand.kind === 'user' ? 'users' : 'this collection';

			return {
				message: `\`${operand.name}\` is not a field of ${owner}`,
				start: operand.position,
				end: wordEnd(text, operand.position)
			};
		}
	}

	return null;
}
