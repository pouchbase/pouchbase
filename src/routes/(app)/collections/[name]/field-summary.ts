import type { GridField } from './grid';
import type { PluginFieldTypeLike } from '#lib/fields/field-type-info.js';

import { fieldTypeInfo } from '#lib/fields/field-type-info.js';
import {
	COMPUTED_TRANSFORMS,
	ID_GENERATORS,
	idGenerator,
	RELATION_ON_DELETE,
	relationOnDelete
} from '#lib/fields/field-types.js';

/** The type, plus what sets this field apart, e.g. `Computed · Slug of title`. */
export function describeField(
	field: Pick<GridField, 'type' | 'options' | 'system'>,
	pluginTypes?: readonly PluginFieldTypeLike[]
) {
	const type = fieldTypeInfo(field, pluginTypes);

	// The plugin isn't installed: the field keeps its data, but can't be edited.
	if (type.orphaned) {
		return type.description;
	}

	const parts: string[] = [type.label];

	if (type.plugin) {
		parts.push(`Plugin ${type.plugin.name ?? type.plugin.id}`);
	}

	if (field.type === 'computed' && field.options.transform) {
		const transform = COMPUTED_TRANSFORMS[field.options.transform].label;

		parts.push(field.options.source ? `${transform} of ${field.options.source}` : transform);
	}

	if (field.type === 'id') {
		parts.push(ID_GENERATORS[idGenerator(field.options)].label);
	}

	if ((field.type === 'relation' || field.type === 'list') && field.options.multiple) {
		parts.push('Multiple');
	}

	if (field.type === 'relation' && relationOnDelete(field.options) !== 'set_null') {
		parts.push(`On delete: ${RELATION_ON_DELETE[relationOnDelete(field.options)].label}`);
	}

	if (field.system) {
		parts.push('Built-in');
	}

	return parts.join(' · ');
}
