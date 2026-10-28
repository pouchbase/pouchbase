import type { PluginFieldSnapshot, PluginFieldTypeId } from '#lib/fields/field-types.js';
import type { PluginsService } from '../services/plugins.service';

import { Failure, unwrap } from '../failure';

/**
 * What a field of a plugin's type keeps of it (`FieldOptions.plugin`): the installed type's
 * label, the column (`column` when the field has one already: it never changes) and the default
 * value as the plugin serialized it. A default the plugin serializes to `null` is no default.
 *
 * Throws `INVALID_FIELD_TYPE` (7019) when the type isn't installed and `INVALID_DEFAULT_VALUE`
 * (7003, with the plugin's message as `data.message`) when the plugin refuses the default value.
 */
export async function pluginSnapshot(
	plugins: PluginsService,
	typeId: PluginFieldTypeId,
	name: string,
	defaultValue: string | undefined,
	column: PluginFieldSnapshot['column'] | undefined
): Promise<{ plugin: PluginFieldSnapshot; defaultValue: string | undefined }> {
	const type = await unwrap(plugins.fieldType(typeId));

	if (!type) {
		throw new Failure({ code: 7019, message: 'INVALID_FIELD_TYPE' });
	}

	const plugin: PluginFieldSnapshot = { label: type.label, column: column ?? type.column };

	if (!defaultValue) {
		return { plugin, defaultValue: undefined };
	}

	const [result] = await unwrap(
		plugins.writeFieldValues(type.pluginId, [
			{ type: type.type, name, options: {}, value: defaultValue }
		])
	);

	if (!result || !result.ok) {
		throw invalidDefault(result?.message || 'The default value is not valid');
	}

	if (result.value instanceof Uint8Array) {
		throw invalidDefault("Binary default values can't be stored");
	}

	return result.value === null
		? { plugin, defaultValue: undefined }
		: { plugin: { ...plugin, default: result.value }, defaultValue };
}

function invalidDefault(message: string) {
	return new Failure({ code: 7003, message: 'INVALID_DEFAULT_VALUE', data: { message } });
}
