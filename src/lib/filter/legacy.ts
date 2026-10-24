import { FilterError, parseFilter } from './filter';

/**
 * Upgrades conditions written in the syntax of Pouchbase before 0.9 (`a = "x" && b ?= @request.auth.id`)
 * to the current one (`a == "x" and any(b) == $user.id`). API rules saved before then live on in
 * the database, in backups and in export files of format 1, so they are upgraded when they are
 * read. Never offered to users: the old syntax isn't accepted anywhere else.
 */

/** The old `@request.auth.id != ""`, the rule of "Signed-in users". */
const LEGACY_SIGNED_IN = '$user.id != ""';

const OPERATORS: Record<string, string> = {
	'=': '==',
	'!=': '!=',
	'>': '>',
	'>=': '>=',
	'<': '<',
	'<=': '<=',
	'~': 'contains',
	'!~': 'not contains'
};

/** Rewrites the old syntax token by token; whitespace and strings are kept as they are. */
function convert(text: string): string {
	let output = '';
	// Where the last operand starts in `output`, to wrap it in `any(…)` for `?=` and the like.
	let operandStart = 0;
	let index = 0;

	while (index < text.length) {
		const char = text[index];
		const rest = text.slice(index);

		if (/\s/.test(char)) {
			output += char;
			index++;
			continue;
		}

		if (rest.startsWith('//')) {
			const end = text.indexOf('\n', index);
			const comment = text.slice(index + 2, end === -1 ? text.length : end);

			output += `#${comment}`;
			index += comment.length + 2;
			continue;
		}

		if (rest.startsWith('&&') || rest.startsWith('||')) {
			output += char === '&' ? 'and' : 'or';
			index += 2;
			continue;
		}

		if (char === '"' || char === "'") {
			let end = index + 1;

			while (end < text.length && text[end] !== char) {
				end += text[end] === '\\' ? 2 : 1;
			}

			operandStart = output.length;
			output += text.slice(index, end + 1);
			index = end + 1;
			continue;
		}

		const operator = /^(\?)?(!=|>=|<=|!~|=|>|<|~)/.exec(rest);

		if (operator) {
			if (operator[1]) {
				const left = output.slice(operandStart).trimEnd();
				const space = output.slice(operandStart + left.length);

				output = `${output.slice(0, operandStart)}any(${left})${space}`;
			}

			output += OPERATORS[operator[2]];
			index += operator[0].length;
			continue;
		}

		const word = /^@?[A-Za-z0-9_.-]+/.exec(rest);

		if (word) {
			operandStart = output.length;
			output += word[0]
				.replace(/^@request\.auth\./, '$user.')
				.replace(/^@request\.body\./, '$input.')
				.replace(/^@now$/, '$now');
			index += word[0].length;
			continue;
		}

		output += char;
		index++;
	}

	return output;
}

function parses(text: string) {
	try {
		parseFilter(text);
		return true;
	} catch (error) {
		if (error instanceof FilterError) {
			return false;
		}

		throw error;
	}
}

/**
 * The condition in the current syntax: `text` itself when it already is, the upgraded condition
 * when it was written in the old syntax, and `text` unchanged when it is invalid in both.
 */
export function upgradeFilter(text: string): string {
	if (!text.trim() || parses(text)) {
		return text;
	}

	const upgraded = convert(text);

	if (upgraded.trim() === LEGACY_SIGNED_IN) {
		return '$user.id != null';
	}

	return parses(upgraded) ? upgraded : text;
}

/** API rules (or anything with a rule per key) with every rule in the current syntax. */
export function upgradeRules<R extends Partial<Record<string, string | null>>>(rules: R): R {
	return Object.fromEntries(
		Object.entries(rules).map(([action, rule]) => [
			action,
			typeof rule === 'string' ? upgradeFilter(rule) : rule
		])
	) as R;
}
