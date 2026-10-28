import type { FieldsError } from '#lib/server/services/fields.service.js';

import { error, invalid } from '@sveltejs/kit';

import { command, form } from '$app/server';
import { requireUser } from '#lib/server/remote.js';

import { isPluginFieldType } from '#lib/fields/field-types.js';
import {
	computeOptions,
	createFieldSchema,
	deleteFieldSchema,
	fileFieldOptions,
	listFieldOptions,
	previewComputedSchema,
	renameFieldSchema,
	updateComputedSchema,
	updateFieldSchema,
	updateFieldsSchema
} from '#lib/schemas/fields.js';
import { fail } from '#lib/server/errors.js';

/** The plugin field type isn't installed (any more). */
const PLUGIN_NOT_INSTALLED = 'This field type comes from a plugin that is not installed';

/** `data.message` of an error, when it has one. */
function dataMessage(failure: { data?: unknown }) {
	const message = (failure.data as { message?: unknown } | undefined)?.message;

	return typeof message === 'string' && message ? message : undefined;
}

function listOf(names: string[], one: string, many: string) {
	return `${names.join(', ')} ${names.length === 1 ? one : many}`;
}

/** What to tell the form for a field error, by code; the handler says which input it belongs to. */
const MESSAGES: Partial<Record<FieldsError['code'], (failure: FieldsError) => string>> = {
	7001: () => 'This name is not allowed',
	7002: () => 'A field with this name already exists',
	7003: (failure) => dataMessage(failure) ?? 'This default value is not valid for the type',
	7009: () => 'Choose an existing collection that has an id field',
	7011: () => 'Choose a text, number or date field of this collection',
	7012: (failure) =>
		listOf(
			(failure.data as { computed: string[] }).computed,
			'is computed from this field. Delete it first.',
			'are computed from this field. Delete them first.'
		),
	7016: (failure) => dataMessage(failure) ?? 'The script failed',
	7018: (failure) => dataMessage(failure) ?? 'Add at least one item',
	7020: (failure) => {
		const { relations } = failure.data as { relations: string[] };

		return `The id field is used by relation ${relations.length === 1 ? 'field' : 'fields'} ${relations.join(', ')}. Delete ${relations.length === 1 ? 'it' : 'them'} first.`;
	},
	7022: () => 'This collection already has an id field',
	7023: (failure) => dataMessage(failure) ?? 'The default value expression is invalid',
	7024: () => 'Turn off Unique for this field first',
	7025: () => 'Some records have more than one value; remove them first',
	7026: (failure) => {
		const { items } = failure.data as { items: string[] };

		return `Records still use ${items.length === 1 ? 'this item' : 'these items'}: ${items.join(', ')}`;
	},
	19016: () => 'The plugin could not check the default value',
	19017: () => 'The plugin could not check the default value'
};

type Issue = (message: string) => Parameters<typeof invalid>[0];

/**
 * Answers a field error: "not found" and "system field" as errors, the codes in `inputs` as an
 * issue of that input (or of the form, with `true`), everything else through `fail()`.
 */
function fieldFailure(failure: FieldsError, inputs: Partial<Record<number, Issue | true>>): never {
	if (failure.code === 6006 || failure.code === 7006) {
		error(404, failure.code === 6006 ? 'Collection not found' : 'Field not found');
	}

	if (failure.code === 7010) {
		error(403, "Built-in fields can't be changed");
	}

	const input = inputs[failure.code];
	const message = MESSAGES[failure.code]?.(failure);

	if (input && message) {
		invalid(input === true ? message : input(message));
	}

	fail(failure);
}

export const createField = form(createFieldSchema, async (data, issue) => {
	const { services } = requireUser();

	const result = await services.fields().create(data.collection, {
		name: data.name,
		type: data.type,
		required: data.required,
		unique: data.unique,
		hidden: data.hidden,
		defaultValue: data.defaultValue,
		options: {
			format: data.format,
			collectionId: data.relationCollection,
			multiple: data.multiple,
			onDelete: data.onDelete,
			generator: data.idGenerator,
			defaultSql: data.defaultSql,
			...(data.type === 'computed' ? computeOptions(data) : {}),
			...(data.type === 'file' ? fileFieldOptions(data) : {}),
			...(data.type === 'list' ? listFieldOptions(data) : {})
		}
	});

	if (result.isErr()) {
		if (result.error.code === 7019) {
			invalid(
				isPluginFieldType(data.type)
					? issue.type(PLUGIN_NOT_INSTALLED)
					: issue.idGenerator('Choose a generator')
			);
		}

		if (result.error.code === 7000) {
			// Usually a unique index on a column that already has duplicate values.
			invalid(
				data.type === 'computed' && data.unique
					? "Existing records would get the same value, so this field can't be unique"
					: 'The field could not be added to the table'
			);
		}

		fieldFailure(result.error, {
			7001: issue.name,
			7002: issue.name,
			7003: issue.defaultValue,
			7009: issue.relationCollection,
			7011: issue.computeSource,
			7016: issue.computeScript,
			7018: issue.listValues,
			7022: issue.type,
			7023: issue.defaultValue,
			19016: issue.defaultValue,
			19017: issue.defaultValue
		});
	}

	// No explicit refresh: the default invalidation also updates the records grid.
	return { name: result.value.name };
});

/** Saves the settings of one field from the edit-field dialog, right away. */
export const updateField = form(updateFieldSchema, async (data, issue) => {
	const { services } = requireUser();

	const result = await services.fields().update(data.collection, data.name, {
		defaultValue: data.defaultValue,
		options: {
			format: data.format,
			multiple: data.multiple,
			onDelete: data.onDelete,
			generator: data.idGenerator,
			defaultSql: data.defaultSql,
			...(data.type === 'file' ? fileFieldOptions(data) : {}),
			...(data.type === 'list' ? listFieldOptions(data) : {})
		}
	});

	if (result.isErr()) {
		if (result.error.code === 7019) {
			invalid(
				data.type === 'id'
					? issue.idGenerator("Auto-increment ids can't change to text ids, or the other way round")
					: isPluginFieldType(data.type)
						? PLUGIN_NOT_INSTALLED
						: 'This field has no settings to change here'
			);
		}

		fieldFailure(result.error, {
			7003: issue.defaultValue,
			7018: issue.listValues,
			7023: issue.defaultValue,
			7024: issue.multiple,
			7025: issue.multiple,
			7026: issue.listValues,
			19016: issue.defaultValue,
			19017: issue.defaultValue
		});
	}

	// No explicit refresh: the default invalidation also updates the records grid.
	return { name: result.value.name };
});

export const renameField = form(renameFieldSchema, async (data, issue) => {
	const { services } = requireUser();

	const result = await services.fields().rename(data.collection, data.name, data.newName);

	if (result.isErr()) {
		fieldFailure(result.error, { 7001: issue.newName, 7002: issue.newName });
	}

	// No explicit refresh: the default invalidation also updates the records grid.
	return { name: result.value.name };
});

export const deleteField = form(deleteFieldSchema, async (data) => {
	const { services } = requireUser();

	const result = await services.fields().delete(data.collection, data.name);

	if (result.isErr()) {
		fieldFailure(result.error, { 7012: true, 7020: true });
	}
});

/** Changes how a computed field is calculated; every record is recalculated. */
export const updateComputedField = form(updateComputedSchema, async (data, issue) => {
	const { services } = requireUser();

	const result = await services
		.fields()
		.updateComputed(data.collection, data.name, computeOptions(data));

	if (result.isErr()) {
		fieldFailure(result.error, { 7011: issue.computeSource, 7016: issue.computeScript });
	}

	return { name: result.value.name };
});

/** Tries a calculation on the newest records without saving anything. */
export const previewComputed = command(previewComputedSchema, async (data) => {
	const { services } = requireUser();

	const result = await services.records().previewComputed(data.collection, computeOptions(data));

	if (result.isErr()) {
		if (result.error.code === 6006) {
			error(404, 'Collection not found');
		}

		fail(result.error);
	}

	return result.value;
});

/** Saves the edit collection sheet: every field's settings and the display order. */
export const updateFields = form(updateFieldsSchema, async (data, issue) => {
	const { services } = requireUser();

	const result = await services.fields().updateAll(data.collection, data.fields);

	if (result.isErr()) {
		const failure = result.error;
		const index = (id: string) => data.fields.findIndex((field) => field.id === id);
		const named = (id: string | undefined) => issue.fields[id ? index(id) : -1]?.name;

		if (failure.code === 7001 || failure.code === 7002) {
			const field = named(failure.data?.id);

			fieldFailure(failure, { 7001: field ?? true, 7002: field ?? true });
		}

		if (failure.code === 7015) {
			const field = data.fields[index(failure.data.id)];

			invalid(`Records share a value in ${field?.name}, so it can't be unique`);
		}

		if (failure.code === 7012) {
			invalid(
				listOf(
					failure.data.computed,
					'is computed from a removed field. Remove it too, or keep its source.',
					'are computed from removed fields. Remove them too, or keep their sources.'
				)
			);
		}

		fieldFailure(failure, { 7020: true });
	}

	// No explicit refresh: the default invalidation also updates the records grid.
	return { saved: true };
});
