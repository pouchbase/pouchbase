import type { Field } from '../services/fields.service';

import { isRelationType } from '#lib/fields/field-types.js';
import { FilterError, MAX_RELATION_DEPTH } from '#lib/filter/filter.js';

/**
 * The `select` and `include` parameters of the records API, checked against the fields a caller
 * may read. Every function throws a `FilterError` with a message for the caller.
 */

/** Relation fields to expand by name, each with the fields to expand in its related records. */
export type IncludeTree = Map<string, IncludeTree>;

/** The fields the API returns: `names` (checked) or all readable ones. */
export function selectFields(readable: Field[], names: string[] | undefined) {
	if (!names?.length) {
		return readable;
	}

	for (const name of names) {
		if (!readable.some((field) => field.name === name)) {
			throw new FilterError(`Unknown field \`${name}\``);
		}
	}

	return readable.filter((field) => names.includes(field.name));
}

/**
 * `?include=author,comments.author` as a tree of field names; a path that is empty or deeper
 * than `MAX_RELATION_DEPTH` is refused.
 */
export function parseInclude(paths: string[] | undefined): IncludeTree {
	const tree: IncludeTree = new Map();

	for (const path of paths ?? []) {
		const names = path.split('.').map((name) => name.trim());

		if (names.some((name) => !name)) {
			throw new FilterError(`Invalid path \`${path}\``);
		}

		if (names.length > MAX_RELATION_DEPTH) {
			throw new FilterError(
				`\`${path}\` is too deep: relations can be included ${MAX_RELATION_DEPTH} levels deep`
			);
		}

		let level = tree;

		for (const name of names) {
			let next = level.get(name);

			if (!next) {
				next = new Map();
				level.set(name, next);
			}

			level = next;
		}
	}

	return tree;
}

/**
 * `paths` (or a tree of them) as a tree, checking that every field of its first level is a
 * relation or file field of `readable`.
 */
export function includeTree(readable: Field[], paths: string[] | IncludeTree | undefined) {
	const tree = paths instanceof Map ? paths : parseInclude(paths);

	for (const name of tree.keys()) {
		const field = readable.find((field) => field.name === name);

		if (!field) {
			throw new FilterError(`Unknown field \`${name}\``);
		}

		if (!isRelationType(field.type)) {
			throw new FilterError(`\`${name}\` is not a relation or file field`);
		}
	}

	return tree;
}

/** The fields to select: `names` plus the fields to expand, or all of them without `names`. */
export function withIncluded(names: string[] | undefined, tree: IncludeTree) {
	return names?.length ? [...new Set([...names, ...tree.keys()])] : names;
}

/** The ids in a decoded relation value: one id, an array of them, or none. */
export function relatedIds(value: unknown) {
	if (Array.isArray(value)) {
		return value.map(String);
	}

	return value === null || value === undefined ? [] : [String(value)];
}
