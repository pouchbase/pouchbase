import type { ColumnType, FieldOptions, FieldTypeDefinition, FieldTypeId } from './field-types';

import { splitPluginFieldType } from '@pouchbasejs/plugin-sdk';

import { FIELD_TYPES } from './field-types';

/**
 * What the dashboard shows of a field's type, for built-in types and those of plugins alike. A
 * plugin's type is described by the installed plugin, or else by what the field remembers of it
 * (`FieldOptions.plugin`): a field whose plugin or type isn't installed is `orphaned`. Its data
 * stays, but it can't be edited until the plugin is back.
 */

/** The parts of a plugin's field type that describe it (a `PluginFieldType` fits). */
export type PluginFieldTypeLike = {
	id: string;
	pluginId: string;
	pluginName: string;
	label: string;
	description: string | null;
	column: ColumnType;
	/** The type's own icon, drawn in one color (`Icon.Root src`); `null` or missing for none. */
	iconUrl?: string | null;
};

export type FieldTypeInfo = FieldTypeDefinition & {
	/**
	 * The URL of a plugin type's own icon, shown instead of `icon` (`<Icon.Root icon={info.icon}
	 * src={info.iconUrl} />`); `null` for the built-in types and plugin types without one, which
	 * show `icon` (a puzzle piece for plugin types).
	 */
	iconUrl: string | null;
	/** For a plugin's type: the plugin and its own id of the type, e.g. `demo` and `rating`. */
	plugin: { id: string; type: string; name: string | null } | null;
	/** A plugin's type whose plugin (or the type itself) isn't installed. */
	orphaned: boolean;
};

/** A field's type, or the field itself (its `options.plugin` describes a missing plugin type). */
type FieldLike = FieldTypeId | string | { type: FieldTypeId | string; options?: FieldOptions };

/**
 * The description of a field type, built-in or from a plugin. Without `pluginTypes` (the
 * installed plugin types, when they aren't known) a plugin's type is never `orphaned`.
 */
export function fieldTypeInfo(
	field: FieldLike,
	pluginTypes?: readonly PluginFieldTypeLike[]
): FieldTypeInfo {
	const type = typeof field === 'string' ? field : field.type;
	const options = typeof field === 'string' ? undefined : field.options;

	if (Object.hasOwn(FIELD_TYPES, type)) {
		return {
			...FIELD_TYPES[type as keyof typeof FIELD_TYPES],
			iconUrl: null,
			plugin: null,
			orphaned: false
		};
	}

	const parts = splitPluginFieldType(type);

	if (!parts) {
		return {
			label: type,
			description: 'A field type this version of Pouchbase does not know.',
			icon: 'lucide:circle-help',
			iconUrl: null,
			column: 'TEXT',
			defaultable: false,
			plugin: null,
			orphaned: true
		};
	}

	const installed = pluginTypes?.find((candidate) => candidate.id === type);
	const orphaned = pluginTypes !== undefined && !installed;
	const label = installed?.label ?? options?.plugin?.label ?? parts.type;

	return {
		label,
		description: orphaned
			? `Plugin field · ${type} · plugin not installed`
			: (installed?.description ??
				`A field type of the plugin ${installed?.pluginName ?? parts.pluginId}.`),
		icon: 'lucide:puzzle',
		iconUrl: installed?.iconUrl ?? null,
		// The column is fixed when the field is created; the plugin's type may change later.
		column: options?.plugin?.column ?? installed?.column ?? 'TEXT',
		defaultable: !orphaned,
		plugin: { id: parts.pluginId, type: parts.type, name: installed?.pluginName ?? null },
		orphaned
	};
}

/** Whether a field's type is a plugin's type that isn't installed (see `fieldTypeInfo`). */
export function isOrphaned(field: FieldLike, pluginTypes: readonly PluginFieldTypeLike[]) {
	return fieldTypeInfo(field, pluginTypes).orphaned;
}
