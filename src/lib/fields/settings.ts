import type { FieldOptions, FieldTypeId } from './types';

import { fileFieldRules } from '#lib/files/accept.js';
import { MAX_FILE_SIZE } from '#lib/files/files.js';

import { computedOptions } from './computed';
import { ID_GENERATORS } from './id';
import { listOptions, listValuesIssue, cleanListValues } from './lists';
import { RELATION_ON_DELETE, relationOnDelete } from './relations';
import { checkSqlExpression, SQL_DEFAULT_TYPES } from './sql-expression';
import { FIELD_TYPES, isAutoType, isPluginFieldType, NOW_DEFAULT } from './types';

/**
 * The type-specific settings of a field (its default value and options), checked and cleaned up
 * the same way by the forms and by the fields service.
 */

/**
 * Checks a default value (as typed in a form) against the field type.
 *
 * @returns An error message, or `null` when the value is valid.
 */
export function validateDefaultValue(type: FieldTypeId, value: string): string | null {
	// A plugin checks the default values of its types itself, when the field is saved.
	if (isPluginFieldType(type)) {
		return null;
	}

	switch (type) {
		case 'id':
		case 'created':
		case 'updated':
		case 'blob':
		case 'file':
		case 'computed':
			return `${FIELD_TYPES[type].label} fields have no default value`;
		case 'number':
			return value.trim() !== '' && Number.isFinite(Number(value)) ? null : 'Enter a number';
		case 'integer':
			return /^-?\d+$/.test(value.trim()) ? null : 'Enter a whole number';
		case 'boolean':
			return value === 'true' || value === 'false' ? null : 'Enter true or false';
		case 'date':
			return value === NOW_DEFAULT || !Number.isNaN(Date.parse(value))
				? null
				: `Enter a date, e.g. 2026-01-31, or ${NOW_DEFAULT}`;
		case 'email':
			return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Enter an email address';
		case 'url':
			return URL.canParse(value) ? null : 'Enter a URL, e.g. https://example.com';
		case 'json':
			try {
				JSON.parse(value);

				return null;
			} catch {
				return 'Enter valid JSON';
			}
		default:
			return null;
	}
}

/** Valid `accept` rules, and `maxSize` only when it is below the global upload limit. */
export function fileOptions(options: FieldOptions): FieldOptions {
	const { accept, maxSize } = fileFieldRules(options);

	return maxSize < MAX_FILE_SIZE ? { accept, maxSize } : { accept };
}

/** What is wrong with a field's settings: which setting, and a message for the form. */
export type FieldSettingsIssue = {
	kind: 'generator' | 'list' | 'default' | 'expression';
	message: string;
};

export type FieldSettings = {
	/** Only the options of the field's type. */
	options: FieldOptions;
	/** `undefined` when the field has no default. */
	defaultValue: string | undefined;
};

/**
 * The options and default value of a field of this type, checked and cleaned up: only the options
 * of the type are kept. `issues` is empty when the settings are valid.
 */
export function fieldSettings(
	type: FieldTypeId,
	defaultValue: string | undefined,
	input: FieldOptions
): FieldSettings & { issues: FieldSettingsIssue[] } {
	const issues: FieldSettingsIssue[] = [];

	if (type === 'id' && !Object.hasOwn(ID_GENERATORS, input.generator ?? '')) {
		issues.push({ kind: 'generator', message: 'Choose a generator' });
	}

	// Computed and automatic values are always filled in, so they have no default.
	if (type === 'computed' || isAutoType(type)) {
		defaultValue = undefined;
	}

	const defaultSql = !!input.defaultSql && !!defaultValue;

	if (defaultSql && !SQL_DEFAULT_TYPES.has(type)) {
		issues.push({ kind: 'default', message: 'This type has no SQL default' });
	}

	const expressionError = defaultSql ? checkSqlExpression(defaultValue!) : null;

	if (expressionError) {
		issues.push({ kind: 'expression', message: expressionError });
	}

	const defaultError =
		!defaultSql && defaultValue ? validateDefaultValue(type, defaultValue) : null;

	if (defaultError) {
		issues.push({ kind: 'default', message: defaultError });
	}

	const list = type === 'list' ? listOptions(input) : null;

	if (type === 'list' && !list) {
		issues.push({ kind: 'list', message: listValuesIssue(cleanListValues(input.values))! });
	}

	if (list && defaultValue && !list.values!.includes(defaultValue)) {
		issues.push({ kind: 'default', message: 'Choose one of the items' });
	}

	const options: FieldOptions =
		type === 'rich_text'
			? { format: input.format ?? 'html' }
			: type === 'relation'
				? {
						collectionId: input.collectionId,
						multiple: input.multiple ?? false,
						onDelete: Object.hasOwn(RELATION_ON_DELETE, input.onDelete ?? '')
							? input.onDelete
							: relationOnDelete({})
					}
				: type === 'computed'
					? (computedOptions(input) ?? {})
					: type === 'file'
						? { ...fileOptions(input), collectionId: input.collectionId }
						: type === 'id'
							? { generator: input.generator }
							: isPluginFieldType(type)
								? input.plugin
									? { plugin: input.plugin }
									: {}
								: (list ?? {});

	if (defaultSql) {
		options.defaultSql = true;
	}

	return { options, defaultValue: defaultValue || undefined, issues };
}
