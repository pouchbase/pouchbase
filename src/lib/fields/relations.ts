import type { FieldOptions } from './types';

/**
 * What deleting a record does to the records that link to it through a relation field: unlink it
 * (the field becomes empty, or loses the id when it allows multiple), delete them too, or refuse
 * the delete while any record links to it.
 */
export const RELATION_ON_DELETE = {
	set_null: {
		label: 'Unlink',
		description: 'Remove the link; the records that linked to it stay.'
	},
	cascade: {
		label: 'Cascade',
		description: 'Delete the records that link to it too.'
	},
	restrict: {
		label: 'Restrict',
		description: "Don't allow the delete while records link to it."
	}
} as const satisfies Record<string, { label: string; description: string }>;

export type RelationOnDelete = keyof typeof RELATION_ON_DELETE;

export const RELATION_ON_DELETE_IDS = Object.keys(RELATION_ON_DELETE) as [
	RelationOnDelete,
	...RelationOnDelete[]
];

/** What deleting a related record does to a relation field; fields from before this unlink. */
export function relationOnDelete(options: FieldOptions): RelationOnDelete {
	return options.onDelete ?? 'set_null';
}
