import type { GridField } from './grid';

import { idGenerator, relationOnDelete } from '#lib/fields/field-types.js';
import { splitFileTypes } from '#lib/files/accept.js';

const MB = 1024 * 1024;

/** The starting values of the field settings: the field's current settings, or a new field's. */
export function initialSettings(field: GridField | undefined) {
	const options = field?.options ?? {};
	const fileTypes = splitFileTypes(options.accept ?? []);

	return {
		generator: field ? idGenerator(options) : undefined,
		format: options.format ?? 'html',
		multiple: !!options.multiple,
		onDelete: relationOnDelete(options),
		listValues: options.values ?? [],
		fileTypes: fileTypes.presets,
		customFileTypes: fileTypes.custom.join(', '),
		maxFileSize: options.maxSize ? String(Math.round((options.maxSize / MB) * 100) / 100) : '',
		defaultValue: field?.defaultValue ?? '',
		defaultSql: !!options.defaultSql
	};
}

export type InitialSettings = ReturnType<typeof initialSettings>;
