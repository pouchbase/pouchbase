import type { RemoteFormInvalidField } from '$app/server';
import type { SaveRecordInput } from '#lib/schemas/records.js';

import { error, invalid } from '@sveltejs/kit';

import { getRequestEvent } from '$app/server';

import { describeFileTypes, matchesFileTypes } from '#lib/files/accept.js';
import {
	FILES_COLLECTION,
	formatFileSize,
	MANAGED_FILE_FIELDS,
	MAX_FILE_SIZE
} from '#lib/files/files.js';

import { fail } from '../errors';

/**
 * The files of the record form: uploads for file fields of any collection, and records of the
 * built-in `files` collection, whose upload goes to storage first. Used by `saveRecord`.
 */

type Values = NonNullable<SaveRecordInput['values']>;
type Issue = RemoteFormInvalidField<SaveRecordInput>;

/** Turns a failed record write into form issues or an HTTP error. */
export function failRecordWrite(
	failure: { code: number; message: string; data?: unknown },
	issue: Issue
): never {
	switch (failure.code) {
		case 6006:
		case 8003:
		case 13003:
			error(404, 'Record not found');
			break;
		case 8001:
			invalid(
				...Object.entries((failure.data as { issues: Record<string, string> }).issues).map(
					([field, message]) => issue.values[field](message)
				)
			);
			break;
		case 8002:
			invalid(
				issue.values[(failure.data as { field: string }).field](
					'This value is already used by another record'
				)
			);
			break;
		case 8012:
			invalid('Add a field to this collection first');
			break;
		case 13001:
			invalid(issue._file(`Files can be at most ${formatFileSize(MAX_FILE_SIZE)}`));
			break;
		case 13002:
			invalid(issue._file('This file is empty'));
			break;
	}

	fail(failure);
}

/** Deletes files stored for a record that then failed to save, so they aren't left behind. */
export async function removeFiles(ids: string[]) {
	if (ids.length) {
		await getRequestEvent().locals.services.records().delete(FILES_COLLECTION, ids);
	}
}

/**
 * Stores the files uploaded for file fields (e.g. a user's `avatar`) and single relations to
 * `files` in `files`, and points those fields at the new files in `values`.
 *
 * @returns The ids of the stored files.
 */
export async function storeUploads(data: SaveRecordInput, values: Values, issue: Issue) {
	const { services } = getRequestEvent().locals;
	const uploads = Object.entries(data._uploads ?? {}).filter(
		(entry): entry is [string, File] => entry[1] instanceof File && entry[1].size > 0
	);

	if (!uploads.length) {
		return [];
	}

	const fileFields = await services.records().fileFields(data.collection);

	if (fileFields.isErr()) {
		failRecordWrite(fileFields.error, issue);
	}

	const accepted = new Map(fileFields.value.map((field) => [field.name, field]));

	// Check every upload before storing any, so a wrong type or size doesn't leave files behind.
	const problems = uploads.flatMap(([name, file]) => {
		const rules = accepted.get(name);

		if (!rules) {
			return [];
		}

		if (!matchesFileTypes(rules.accept, file)) {
			return [issue._uploads[name](`Choose a file of type ${describeFileTypes(rules.accept)}`)];
		}

		if (file.size > rules.maxSize) {
			return [issue._uploads[name](`Files can be at most ${formatFileSize(rules.maxSize)}`)];
		}

		return [];
	});

	if (problems.length) {
		invalid(...problems);
	}

	const stored: string[] = [];

	for (const [name, file] of uploads) {
		if (!accepted.has(name)) {
			continue;
		}

		const result = await services.files().create(file);

		if (result.isErr()) {
			await removeFiles(stored);

			switch (result.error.code) {
				case 13001:
					invalid(issue._uploads[name](`Files can be at most ${formatFileSize(MAX_FILE_SIZE)}`));
					break;
				case 13002:
					invalid(issue._uploads[name]('This file is empty'));
					break;
			}

			fail(result.error);
		}

		stored.push(result.value.id);
		values[name] = result.value.id;
	}

	return stored;
}

/**
 * Saves a record of the built-in `files` collection: the upload goes to storage first, then the
 * editable fields (name and custom fields) are saved. `mime_type`, `size` and `key` are never
 * taken from the form.
 */
export async function saveFile(data: SaveRecordInput, values: Values, issue: Issue) {
	const { services } = getRequestEvent().locals;
	const file = data._file instanceof File && data._file.size ? data._file : undefined;

	if (!data.id && !file) {
		invalid(issue._file('Choose a file to upload'));
	}

	let id = data.id;

	if (file) {
		const stored = id
			? await services.files().replace(id, file)
			: await services.files().create(file, String(values.name ?? ''));

		if (stored.isErr()) {
			failRecordWrite(stored.error, issue);
		}

		id = stored.value.id;
	}

	const editable = Object.fromEntries(
		Object.entries(values).filter(
			// An empty name keeps the stored one (the uploaded file's name).
			([name, value]) => !MANAGED_FILE_FIELDS.has(name) && !(name === 'name' && value === '')
		)
	);
	const result = await services
		.records()
		.update(FILES_COLLECTION, id!, editable, { partial: true });

	if (result.isErr()) {
		failRecordWrite(result.error, issue);
	}

	return { id: result.value.id };
}
