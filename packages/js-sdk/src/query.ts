/**
 * Typed queries for `pouch.db`: `where` objects, `orderBy`, `select` and `include`, compiled to the
 * query string of the records API (`where`, `order`, `select`, `include`). Values are always
 * escaped, so a value from a user can never change the query.
 */

/** A value of a JSON field. */
export type JsonValue =
	string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const CONDITION: unique symbol = Symbol('pouchbase.condition');

/** A condition written by hand with `condition\`…\``; its values are escaped. */
export type Condition = { readonly [CONDITION]: string };

/** Values that can be put in a condition. */
export type ConditionValue = string | number | boolean | null | undefined | Date;

/** The item type of an array field. */
type ItemOf<V> = V extends readonly (infer I)[] ? I : never;

/** Comparisons for every field. */
type Equality<V> = {
	/** Equal to the value. `null` (or `''`) matches empty fields. */
	eq?: V | null;
	/** Not equal to the value. `null` matches fields that are not empty. */
	not?: V | null;
	/** Equal to one of the values. */
	in?: readonly V[];
	/** Equal to none of the values. */
	notIn?: readonly V[];
};

/** Comparisons for fields that can be ordered: numbers, text and dates. */
type Ordering<V> = {
	gt?: V;
	gte?: V;
	lt?: V;
	lte?: V;
};

/** Text search, case-insensitive. */
type TextSearch = {
	/** Contains the text. */
	contains?: string;
	/** Doesn't contain the text. */
	notContains?: string;
	/** Starts with the text. */
	startsWith?: string;
	/** Ends with the text. */
	endsWith?: string;
};

/** Conditions for multiple relations, files and lists (arrays). */
type ArrayConditions<I> = {
	/** One of the items equals the value. */
	has?: I;
	/** Has no items (`true`) or at least one (`false`). */
	isEmpty?: boolean;
};

/** What a field can be compared with, depending on its type. */
export type FieldCondition<V> = [NonNullable<V>] extends [readonly unknown[]]
	? ArrayConditions<ItemOf<NonNullable<V>>>
	: [NonNullable<V>] extends [boolean]
		? NonNullable<V> | null | Equality<NonNullable<V>>
		: [NonNullable<V>] extends [number]
			? NonNullable<V> | null | (Equality<NonNullable<V>> & Ordering<NonNullable<V>>)
			: [NonNullable<V>] extends [string]
				? | NonNullable<V>
					| null
					| (Equality<NonNullable<V>> & Ordering<NonNullable<V> | Date> & TextSearch)
				: Equality<NonNullable<V>>;

/**
 * Which records to match, typed by the record: a value per field means "equals", an object holds
 * comparisons (`{ views: { gt: 10 } }`), and `$or` / `$and` combine conditions. Fields next to
 * each other must all match.
 *
 * ```ts
 * { status: 'published', views: { gte: 10 }, $or: [{ author: userId }, { featured: true }] }
 * ```
 */
export type Where<R> = {
	[K in keyof R]?: FieldCondition<R[K]>;
} & {
	/** At least one of these must match. */
	$or?: readonly Where<R>[];
	/** All of these must match. */
	$and?: readonly Where<R>[];
};

/** The sort order: fields in order of importance, each ascending or descending. */
export type OrderBy<R> = { [K in keyof R]?: 'asc' | 'desc' };

/** Field names of a record. */
export type FieldName<R> = keyof R & string;

/** The record with only the selected fields; the whole record without a selection. */
export type Selected<R, S> = S extends readonly FieldName<R>[] ? Pick<R, S[number]> : R;

const NAME = /^[a-z][a-z0-9_]{0,62}$/;

/** A condition that no record matches. */
const NOTHING = '1 == 0';

/** A value as a literal of the condition syntax. */
function literal(value: ConditionValue): string {
	if (value === null || value === undefined) {
		return 'null';
	}

	if (value instanceof Date) {
		return literal(value.toISOString());
	}

	if (typeof value === 'number') {
		if (!Number.isFinite(value)) {
			throw new TypeError(`Can't compare with ${value}`);
		}

		return String(value);
	}

	if (typeof value === 'boolean') {
		return String(value);
	}

	if (typeof value === 'string') {
		return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
	}

	throw new TypeError(`Can't compare with a value of type ${typeof value}`);
}

function fieldName(name: string) {
	if (!NAME.test(name)) {
		throw new TypeError(`\`${name}\` is not a field name`);
	}

	return name;
}

/**
 * A condition written by hand, in the syntax of the API rules, for what `where` can't express,
 * such as the signed-in user (`$user.id`). Values in `${…}` are escaped, so they can come from
 * users.
 *
 * ```ts
 * pouch.db.posts.findMany({ where: condition`author == $user.id || contains(title, ${search})` });
 * ```
 */
export function condition(strings: TemplateStringsArray, ...values: ConditionValue[]): Condition {
	return {
		[CONDITION]: strings.reduce(
			(text, part, index) => text + part + (index < values.length ? literal(values[index]) : ''),
			''
		)
	};
}

function isCondition(value: unknown): value is Condition {
	return !!value && typeof value === 'object' && CONDITION in value;
}

function isComparisons(value: unknown) {
	return (
		!!value &&
		typeof value === 'object' &&
		!(value instanceof Date) &&
		!Array.isArray(value) &&
		!isCondition(value)
	);
}

const OPERATORS: Record<string, string> = {
	eq: '==',
	not: '!=',
	gt: '>',
	gte: '>=',
	lt: '<',
	lte: '<='
};

/** Comparisons that are functions of the condition syntax: `contains(title, "x")`. */
const FUNCTIONS: Record<string, { name: string; not?: boolean }> = {
	contains: { name: 'contains' },
	notContains: { name: 'contains', not: true },
	startsWith: { name: 'starts_with' },
	endsWith: { name: 'ends_with' }
};

/** One field's comparisons as parts of a condition. */
function fieldParts(name: string, comparisons: unknown): string[] {
	if (comparisons === undefined) {
		return [];
	}

	if (!isComparisons(comparisons)) {
		return [`${name} == ${literal(comparisons as ConditionValue)}`];
	}

	return Object.entries(comparisons as Record<string, unknown>).flatMap(([operator, value]) => {
		if (value === undefined) {
			return [];
		}

		const values = value as ConditionValue[];

		switch (operator) {
			case 'in':
				// Nothing to match: no record matches.
				return [
					values.length
						? `(${values.map((item) => `${name} == ${literal(item)}`).join(' || ')})`
						: NOTHING
				];
			case 'notIn':
				return values.map((item) => `${name} != ${literal(item)}`);
			case 'has':
				return [`any(${name}) == ${literal(value as ConditionValue)}`];
			case 'isEmpty':
				return [`${name} ${value ? '==' : '!='} ""`];
			default: {
				const fn = FUNCTIONS[operator];

				if (fn) {
					const call = `${fn.name}(${name}, ${literal(value as ConditionValue)})`;

					return [fn.not ? `!${call}` : call];
				}

				const symbol = OPERATORS[operator];

				if (!symbol) {
					throw new TypeError(`Unknown comparison \`${operator}\` for \`${name}\``);
				}

				return [`${name} ${symbol} ${literal(value as ConditionValue)}`];
			}
		}
	});
}

/** A `where` object as a condition; `''` when it matches every record. */
export function compileWhere(where: object | undefined): string {
	if (!where) {
		return '';
	}

	if (isCondition(where)) {
		return where[CONDITION];
	}

	const parts = Object.entries(where).flatMap(([key, comparisons]): string[] => {
		if (key === '$or' || key === '$and') {
			const branches = (comparisons as object[] | undefined) ?? [];
			const compiled = branches.map((branch) => compileWhere(branch));

			// An empty `$or` matches nothing, an empty branch everything.
			if (key === '$or' && (!compiled.length || compiled.some((part) => !part))) {
				return compiled.length ? [] : [NOTHING];
			}

			const filled = compiled.filter(Boolean);

			return filled.length ? [`(${filled.join(key === '$or' ? ' || ' : ' && ')})`] : [];
		}

		return fieldParts(fieldName(key), comparisons);
	});

	return parts.join(' && ');
}

/** An `orderBy` object as `order` (`created_at:desc,title:asc`). */
export function compileOrderBy(orderBy: Record<string, string | undefined> | undefined): string {
	return Object.entries(orderBy ?? {})
		.filter(([, direction]) => direction)
		.map(([name, direction]) => `${fieldName(name)}:${direction === 'desc' ? 'desc' : 'asc'}`)
		.join(',');
}

/** A `select` list as `select` (`id,title`). */
export function compileSelect(select: readonly string[] | undefined): string | undefined {
	return select?.length ? select.map(fieldName).join(',') : undefined;
}

/** What `include` holds per relation: `true`, or the relations of its records to include too. */
type IncludeTree = { [field: string]: true | { include?: IncludeTree } | undefined };

/** An `include` object as `include` (`author,comments.author`). */
export function compileInclude(include: IncludeTree | undefined): string | undefined {
	const paths = (tree: IncludeTree, prefix: string): string[] =>
		Object.entries(tree).flatMap(([name, option]) => {
			if (!option) {
				return [];
			}

			const path = `${prefix}${fieldName(name)}`;
			const nested = option === true || !option.include ? [] : paths(option.include, `${path}.`);

			return nested.length ? nested : [path];
		});

	const included = paths(include ?? {}, '');

	return included.length ? included.join(',') : undefined;
}
