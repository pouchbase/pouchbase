import type { FieldOptions, FieldTypeId } from '#lib/fields/field-types.js';
import type { listPluginFieldTypes } from '#lib/remote/plugins.remote.js';

import { resolve } from '$app/paths';

import { fieldTypeInfo } from '#lib/fields/field-type-info.js';

/** A field type of an installed plugin, as `listPluginFieldTypes` returns it. */
export type PluginType = Awaited<ReturnType<typeof listPluginFieldTypes>>[number];

/** A field as returned by `listRecords`. */
export type GridField = {
	id: string;
	name: string;
	type: FieldTypeId;
	required: boolean;
	unique: boolean;
	/** Left out of the records API for app users. */
	hidden: boolean;
	defaultValue: string | null;
	options: FieldOptions;
	/** Fields of built-in collections (like `users`) can't be renamed or deleted. */
	system: boolean;
};

export type RelationRef = { id: string; label: string };

export type GridValue = string | number | null | RelationRef[];

/**
 * A record with a value per field. `_key` identifies it: the value of its ID field, or its row
 * number when the collection has none. Field names start with a letter, so it never collides.
 */
export type GridRecord = { _key: string } & {
	[column: string]: GridValue;
};

/** A column of the grid: a field, or a virtual column of a built-in collection. */
export type GridColumn = {
	name: string;
	label: string;
	icon: string;
	/** A plugin type's own icon, drawn instead of `icon` (`Icon.Root src`); `null` for none. */
	iconUrl?: string | null;
	/** Undefined for virtual columns. */
	field?: GridField;
	sortable: boolean;
	/** Read-only column that isn't stored in the table, e.g. the sign-in methods of users. */
	virtual?: 'sign-in' | 'preview';
	/** Collection a relation field points to, e.g. `files` (shows thumbnails). */
	relationTarget?: string;
	/** Show the value as a file size (`size` of the built-in `files` collection). */
	fileSize?: boolean;
	/** For a field with a plugin's type: the installed type (`null` when it isn't installed). */
	pluginType?: PluginType | null;
};

/**
 * Sign-in methods of the built-in `users` collection (linked OAuth accounts and passwords).
 * Field names can't start with `_`, so this name never collides with a field.
 */
export const SIGN_IN_COLUMN: GridColumn = {
	name: '_sign_in',
	label: 'Sign-in',
	icon: 'lucide:shield-check',
	sortable: false,
	virtual: 'sign-in'
};

/** Thumbnail of the built-in `files` collection's records. */
export const PREVIEW_COLUMN: GridColumn = {
	name: '_preview',
	label: 'Preview',
	icon: 'lucide:image',
	sortable: false,
	virtual: 'preview'
};

/** The plugin field type of `field` among the installed ones; `undefined` for built-in types. */
export function pluginTypeOf(field: Pick<GridField, 'type'>, pluginTypes: readonly PluginType[]) {
	return fieldTypeInfo(field.type).plugin
		? (pluginTypes.find((type) => type.id === field.type) ?? null)
		: undefined;
}

/** The plugin a component of a plugin field type belongs to, for `PluginComponent.Root`. */
export function pluginRef(type: PluginType) {
	return {
		id: type.pluginId,
		version: type.pluginVersion,
		embedded: type.embedded,
		name: type.pluginName
	};
}

/** What a plugin's input and preview components get as `field` (`FieldInfo`). */
export function pluginFieldInfo(field: GridField) {
	// The snapshot of the type is Pouchbase's, not one of the field's own options.
	const options = Object.fromEntries(
		Object.entries(field.options).filter(([key]) => key !== 'plugin')
	);

	return { name: field.name, type: field.type, required: field.required, options };
}

export function fieldColumn(field: GridField, pluginTypes: readonly PluginType[] = []): GridColumn {
	const type = fieldTypeInfo(field, pluginTypes);

	return {
		name: field.name,
		label: type.label,
		icon: type.icon,
		iconUrl: type.iconUrl,
		field,
		sortable: field.type !== 'blob',
		pluginType: pluginTypeOf(field, pluginTypes)
	};
}

/** A value as text, for values the grid has no other way to show (e.g. of a plugin field). */
export function rawValue(value: unknown) {
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}

/** Link that opens a record in its collection's record sheet. */
export function recordHref(collection: string, id: string) {
	const search = new URLSearchParams({ record: id });

	return resolve(`/(app)/collections/[name]?${search}`, { name: collection });
}

/** When the record was last saved: its first `updated` field, if the collection has one. */
export function lastUpdated(record: GridRecord, fields: GridField[]) {
	const field = fields.find((candidate) => candidate.type === 'updated');
	const value = field ? record[field.name] : null;

	return typeof value === 'number' ? value : undefined;
}

/** `2026-01-31 14:05:09` in UTC, so server and browser render the same text. */
export function formatTimestamp(value: number | string) {
	const date = new Date(value);

	return Number.isNaN(date.getTime())
		? String(value)
		: date.toISOString().slice(0, 19).replace('T', ' ');
}

/** Plain text preview of rich text content. */
export function plainText(value: string) {
	return value
		.replace(/<[^>]+>/g, ' ')
		.replace(/[#*_`>~-]+/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
