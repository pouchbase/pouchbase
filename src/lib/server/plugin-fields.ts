import type { FieldReadItem, FieldWriteItem, FieldWriteResult } from './plugins/runtime';
import type { FieldOptions, FieldTypeId } from '#lib/fields/field-types.js';
import type { FieldValue } from '@pouchbasejs/plugin-sdk/server';

import { splitPluginFieldType } from '@pouchbasejs/plugin-sdk';

/**
 * Values of fields with a plugin's type, around a record write and after a read. Pure, so the
 * records service only adds the calls: a write sends the submitted values per plugin through
 * `fields.write` (validate, then serialize) and stores what comes back; a read sends the stored
 * values through `fields.read` (deserialize). Fields whose plugin (or type) isn't installed are
 * orphaned: their stored values are returned as they are, and writing them is refused.
 */

/** The parts of a field that its plugin values need. */
export type PluginFieldLike = {
	name: string;
	type: FieldTypeId;
	required: boolean;
	options: FieldOptions;
};

/** A field whose type comes from a plugin, with the plugin's id and its own id of the type. */
type PluginField = { field: PluginFieldLike; pluginId: string; type: string };

/** The values of one plugin's fields to send in one call, and which field each one is for. */
export type PluginWriteBatch = { pluginId: string; fields: string[]; items: FieldWriteItem[] };

export type PluginWritePlan = {
	/** Values that need no plugin: empty values are stored as `null`. */
	values: Record<string, null>;
	/** Validation messages by field name. */
	issues: Record<string, string>;
	/** One call per plugin; no batches when nothing was submitted for a plugin field. */
	batches: PluginWriteBatch[];
};

/** The values of one plugin's fields to read in one call, by field. */
export type PluginReadBatch = { pluginId: string; fields: string[]; items: FieldReadItem[] };

function isEmpty(value: unknown) {
	return value === undefined || value === null || value === '';
}

/** The fields of `fields` that have a plugin's type. */
export function pluginFields(fields: readonly PluginFieldLike[]): PluginField[] {
	return fields.flatMap((field) => {
		const parts = splitPluginFieldType(field.type);

		return parts ? [{ field, pluginId: parts.pluginId, type: parts.type }] : [];
	});
}

/** Whether any of `fields` has a plugin's type. */
export function hasPluginFields(fields: readonly PluginFieldLike[]) {
	return pluginFields(fields).length > 0;
}

/** The field options a plugin's hooks get: the field's own options, without the snapshot. */
export function pluginFieldOptions(options: FieldOptions): Record<string, unknown> {
	return Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'plugin'));
}

/** The message of a write to a field whose plugin isn't installed. */
export function notInstalledMessage(pluginId: string) {
	return `The plugin ${pluginId} is not installed`;
}

/**
 * What to do with the plugin fields of a record write. A field missing from `input` isn't
 * written (a form keeps the stored value; a new record gets the default value), but a required
 * field without a default must be there when the record is created. Empty values are `null`
 * without asking the plugin; other values are sent to it, per plugin.
 *
 * @param installed The ids (`<plugin>:<type>`) of the plugin field types that are installed.
 */
export function planPluginWrites(
	fields: readonly PluginFieldLike[],
	input: Record<string, unknown>,
	installed: ReadonlySet<string>,
	{ creating }: { creating: boolean }
): PluginWritePlan {
	const plan: PluginWritePlan = { values: {}, issues: {}, batches: [] };

	for (const { field, pluginId, type } of pluginFields(fields)) {
		if (!Object.hasOwn(input, field.name)) {
			if (creating && field.required && field.options.plugin?.default === undefined) {
				plan.issues[field.name] = 'Required';
			}

			continue;
		}

		if (!installed.has(field.type)) {
			plan.issues[field.name] = notInstalledMessage(pluginId);
			continue;
		}

		const value = input[field.name];

		if (isEmpty(value)) {
			if (field.required) {
				plan.issues[field.name] = 'Required';
			} else {
				plan.values[field.name] = null;
			}

			continue;
		}

		let batch = plan.batches.find((candidate) => candidate.pluginId === pluginId);

		if (!batch) {
			batch = { pluginId, fields: [], items: [] };
			plan.batches.push(batch);
		}

		batch.fields.push(field.name);
		batch.items.push({
			type,
			name: field.name,
			options: pluginFieldOptions(field.options),
			value
		});
	}

	return plan;
}

/**
 * The values to store and the validation messages, from the answers to the batches of `plan`
 * (one `FieldWriteResult[]` per batch, in order). Binary values can't be written by the records
 * API, so a plugin that serializes to bytes gets a message instead.
 */
export function applyPluginWrites(
	plan: PluginWritePlan,
	results: readonly (readonly FieldWriteResult[])[]
): { values: Record<string, string | number | null>; issues: Record<string, string> } {
	const values: Record<string, string | number | null> = { ...plan.values };
	const issues = { ...plan.issues };

	plan.batches.forEach((batch, index) => {
		batch.fields.forEach((name, position) => {
			const result = results[index]?.[position];

			if (!result) {
				issues[name] = 'The plugin did not check this value';
			} else if (!result.ok) {
				issues[name] = result.message || 'The value is not valid';
			} else if (result.value instanceof Uint8Array) {
				issues[name] = "The plugin turned this value into binary data, which can't be stored";
			} else {
				values[name] = result.value;
			}
		});
	});

	return { values, issues };
}

/** A stored value as a plugin's `deserialize` gets it. */
function fieldValue(value: unknown): FieldValue {
	if (
		value === null ||
		typeof value === 'string' ||
		(typeof value === 'number' && Number.isFinite(value)) ||
		value instanceof Uint8Array
	) {
		return value;
	}

	if (value instanceof ArrayBuffer) {
		return new Uint8Array(value);
	}

	return value === undefined ? null : String(value);
}

/**
 * What to send to `fields.read` for the plugin fields of `records`: per plugin, one item per
 * field with the stored value of every record. Only fields of installed types that the records
 * have (e.g. selected with `?select=`) and only plugins in `deserializes` are read; the others
 * keep their stored values.
 *
 * @param deserializes Ids (`<plugin>:<type>`) of the installed types whose values are read.
 */
export function planPluginReads(
	fields: readonly PluginFieldLike[],
	records: readonly Record<string, unknown>[],
	deserializes: ReadonlySet<string>
): PluginReadBatch[] {
	const batches: PluginReadBatch[] = [];

	if (!records.length) {
		return batches;
	}

	for (const { field, pluginId, type } of pluginFields(fields)) {
		if (!deserializes.has(field.type) || !records.some((record) => field.name in record)) {
			continue;
		}

		let batch = batches.find((candidate) => candidate.pluginId === pluginId);

		if (!batch) {
			batch = { pluginId, fields: [], items: [] };
			batches.push(batch);
		}

		batch.fields.push(field.name);
		batch.items.push({ type, values: records.map((record) => fieldValue(record[field.name])) });
	}

	return batches;
}

/**
 * Puts the answers to the batches of `planPluginReads` (one array per item, in order) into
 * `records`, in place. A missing answer keeps the stored value.
 */
export function applyPluginReads(
	batches: readonly PluginReadBatch[],
	answers: readonly (readonly (readonly unknown[])[])[],
	records: Record<string, unknown>[]
) {
	batches.forEach((batch, index) => {
		batch.fields.forEach((name, position) => {
			const values = answers[index]?.[position];

			if (!values || values.length !== records.length) {
				return;
			}

			records.forEach((record, row) => {
				record[name] = values[row];
			});
		});
	});
}
