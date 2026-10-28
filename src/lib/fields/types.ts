import type { ComputedTransform } from './computed';
import type { IdGenerator } from './id';
import type { RelationOnDelete } from './relations';

import { PLUGIN_FIELD_TYPE_PATTERN } from '@pouchbasejs/plugin-sdk';

/**
 * Field types of a collection. Each type maps onto one of D1's (SQLite's) storage classes and adds
 * its own meaning and validation on top.
 *
 * Shared between the client (forms, icons) and the server (column definitions).
 */

export type ColumnType = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';

export type FieldTypeDefinition = {
	label: string;
	description: string;
	/** Iconify name; literal so the icon bundler can find it. */
	icon: string;
	column: ColumnType;
	/** Whether the type supports a default value. */
	defaultable: boolean;
};

export const FIELD_TYPES = {
	id: {
		label: 'ID',
		description: 'Unique key of each record, generated when it is created. One per collection.',
		icon: 'lucide:key-round',
		column: 'TEXT',
		defaultable: false
	},
	created: {
		label: 'Created',
		description: 'Set to the time the record is created.',
		icon: 'lucide:clock',
		column: 'INTEGER',
		defaultable: false
	},
	updated: {
		label: 'Updated',
		description: 'Set to the time the record is last saved.',
		icon: 'lucide:clock',
		column: 'INTEGER',
		defaultable: false
	},
	text: {
		label: 'Text',
		description: 'Plain text.',
		icon: 'lucide:type',
		column: 'TEXT',
		defaultable: true
	},
	rich_text: {
		label: 'Rich text',
		description: 'Formatted text from the editor, stored as HTML or Markdown.',
		icon: 'lucide:pilcrow',
		column: 'TEXT',
		defaultable: true
	},
	number: {
		label: 'Number',
		description: 'Decimal number.',
		icon: 'lucide:hash',
		column: 'REAL',
		defaultable: true
	},
	integer: {
		label: 'Integer',
		description: 'Whole number.',
		icon: 'lucide:binary',
		column: 'INTEGER',
		defaultable: true
	},
	boolean: {
		label: 'Boolean',
		description: 'True or false, stored as 1 or 0.',
		icon: 'lucide:toggle-left',
		column: 'INTEGER',
		defaultable: true
	},
	date: {
		label: 'Date',
		description: 'Date and time, stored as ISO 8601 text.',
		icon: 'lucide:calendar',
		column: 'TEXT',
		defaultable: true
	},
	email: {
		label: 'Email',
		description: 'Email address.',
		icon: 'lucide:at-sign',
		column: 'TEXT',
		defaultable: true
	},
	url: {
		label: 'URL',
		description: 'Web address.',
		icon: 'lucide:link',
		column: 'TEXT',
		defaultable: true
	},
	json: {
		label: 'JSON',
		description: 'Any JSON value, validated by the database.',
		icon: 'lucide:braces',
		column: 'TEXT',
		defaultable: true
	},
	list: {
		label: 'List',
		description: 'One or more items picked from a fixed list.',
		icon: 'lucide:list',
		column: 'TEXT',
		defaultable: true
	},
	relation: {
		label: 'Relation',
		description: 'Links to one or more records of another collection.',
		icon: 'lucide:link-2',
		column: 'TEXT',
		defaultable: true
	},
	file: {
		label: 'File',
		description: 'An uploaded file, stored in the files collection.',
		icon: 'lucide:paperclip',
		column: 'TEXT',
		defaultable: false
	},
	computed: {
		label: 'Computed',
		description: 'Calculated from another field when a record is saved, e.g. a slug.',
		icon: 'lucide:square-function',
		column: 'TEXT',
		defaultable: false
	},
	blob: {
		label: 'Blob',
		description: 'Binary data.',
		icon: 'lucide:file',
		column: 'BLOB',
		defaultable: false
	}
} as const satisfies Record<string, FieldTypeDefinition>;

export type FieldType = keyof typeof FIELD_TYPES;

export const FIELD_TYPE_IDS = Object.keys(FIELD_TYPES) as [FieldType, ...FieldType[]];

/**
 * A field type that a plugin contributes, stored as `<plugin>:<type>` (e.g. `demo:rating`; see
 * `PLUGIN_FIELD_TYPE_PATTERN` of the plugin SDK). Built-in types never contain a `:`.
 */
export type PluginFieldTypeId = `${string}:${string}`;

/** The type of a field: a built-in one, or one from a plugin. */
export type FieldTypeId = FieldType | PluginFieldTypeId;

/** Whether `type` is a plugin's field type id (`<plugin>:<type>`) rather than a built-in type. */
export function isPluginFieldType(type: string): type is PluginFieldTypeId {
	return PLUGIN_FIELD_TYPE_PATTERN.test(type);
}

/**
 * Field types whose value is filled in by Pouchbase when a record is saved: the record's key and
 * its timestamps (milliseconds since the epoch). They have no required, unique or default setting.
 * A collection has at most one `id` field; without one, records are identified by SQLite's `rowid`
 * and relation fields can't point to it.
 */
export const AUTO_FIELD_TYPES = new Set<FieldType>(['id', 'created', 'updated']);

export function isAutoType(type: FieldTypeId) {
	return AUTO_FIELD_TYPES.has(type as FieldType);
}

/**
 * Field types whose value is the id of a record in another collection: relations, and file fields,
 * which are relations to the built-in `files` collection.
 */
export function isRelationType(type: FieldTypeId) {
	return type === 'relation' || type === 'file';
}

/** Whether the field stores a JSON array: a relation, file or list that allows multiple values. */
export function isMultiple(field: {
	type: FieldTypeId;
	options?: Pick<FieldOptions, 'multiple'> | null;
}): boolean {
	return (
		(field.type === 'relation' || field.type === 'file' || field.type === 'list') &&
		!!field.options?.multiple
	);
}

/**
 * Whether a field can be hidden from app users: not the `id` field, which every record is read by,
 * nor the built-in fields of `users` and `files`, which sign-in and uploads rely on.
 */
export function canHide(field: { type: FieldTypeId; system: boolean }) {
	return field.type !== 'id' && !field.system;
}

/**
 * Fields the built-in collections (`users`, `files`) are created with. Collections you create
 * start without fields.
 */
export const BUILT_IN_DEFAULT_FIELDS = [
	{ name: 'id', type: 'id', options: { generator: 'random' } },
	{ name: 'created_at', type: 'created', options: {} },
	{ name: 'updated_at', type: 'updated', options: {} }
] as const satisfies { name: string; type: FieldType; options: FieldOptions }[];

/** Default value of a date field that stands for the moment the record is created. */
export const NOW_DEFAULT = '@now';

export const RICH_TEXT_FORMATS = ['html', 'markdown'] as const;

export type RichTextFormat = (typeof RICH_TEXT_FORMATS)[number];

/** What a plugin field remembers of its type (see `FieldOptions.plugin`). */
export type PluginFieldSnapshot = {
	label: string;
	column: ColumnType;
	default?: string | number;
};

export type FieldOptions = {
	/** Only for `id`: how the key of a new record is generated. */
	generator?: IdGenerator;
	/** Only for `rich_text`. */
	format?: RichTextFormat;
	/** Only for `relation`: id of the related collection. */
	collectionId?: string;
	/**
	 * Only for `relation`: what happens to records of this collection when a record they link to is
	 * deleted. Missing means `set_null` (see `relationOnDelete`).
	 */
	onDelete?: RelationOnDelete;
	/**
	 * Only for `relation` and `list`: stores a JSON array of ids or items instead of a single
	 * value.
	 */
	multiple?: boolean;
	/** Only for `list`: the items a record can pick from, in display order. */
	values?: string[];
	/**
	 * Only for `file`: accepted MIME types, wildcards and extensions, e.g. `["image/*", ".pdf"]`
	 * (see `#lib/files/accept.js`). Empty or missing accepts every file.
	 */
	accept?: string[];
	/** Only for `file`: largest upload in bytes, at most `MAX_FILE_SIZE`. Missing means that limit. */
	maxSize?: number;
	/** Only for `computed`: name of the field the value is calculated from (not for `script`). */
	source?: string;
	/** Only for `computed`: how the source value is turned into this field's value. */
	transform?: ComputedTransform;
	/**
	 * Only for `computed` with the `script` transform: the body of a JavaScript function of
	 * `record` and `ctx` that returns the value.
	 */
	script?: string;
	/**
	 * The default value is a SQLite expression, evaluated when a record is created (see
	 * `./sql-expression.ts`), e.g. `datetime('now', '+7 days')`.
	 */
	defaultSql?: boolean;
	/**
	 * Only for plugin field types: what the type was when the field was created, so the field stays
	 * describable when the plugin is removed. The column type is fixed for the field's lifetime.
	 * `default` is the default value as the plugin serialized it (the column's DEFAULT); the field's
	 * `defaultValue` keeps what was entered.
	 */
	plugin?: PluginFieldSnapshot;
};
