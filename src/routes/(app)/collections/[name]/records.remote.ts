import { error, invalid } from '@sveltejs/kit';
import { z } from 'zod';

import { command, form, getRequestEvent, query } from '$app/server';
import { requireUser } from '#lib/server/remote.js';

import { USERS_COLLECTION } from '#lib/auth/users.js';
import { FILES_COLLECTION, formatFileSize, MAX_FILE_SIZE } from '#lib/files/files.js';
import { imageEditsSchema } from '#lib/schemas/images.js';
import { appPassword } from '#lib/schemas/password-auth.js';
import {
	deleteRecordsSchema,
	getRecordSchema,
	listRecordsSchema,
	RECORDS_PER_PAGE,
	type SaveRecordInput
} from '#lib/schemas/records.js';
import { fail } from '#lib/server/errors.js';
import {
	failRecordWrite,
	removeFiles,
	saveFile,
	storeUploads
} from '#lib/server/records/uploads.js';

export const listRecords = query(listRecordsSchema, async ({ collection, page, sort, order }) => {
	const result = await getRequestEvent()
		.locals.services.records()
		.list(collection, { page, perPage: RECORDS_PER_PAGE, sort, order });

	if (result.isErr()) {
		if (result.error.code === 6006) {
			error(404, 'Collection not found');
		}

		fail(result.error);
	}

	const { fields, ...rest } = result.value;

	return {
		...rest,
		fields: fields.map(({ id, name, type, required, unique, defaultValue, options, system }) => ({
			id,
			name,
			type,
			required,
			unique,
			defaultValue,
			options,
			system
		}))
	};
});

/** One record, e.g. a related record opened from another collection. */
export const getRecord = query(getRecordSchema, async ({ collection, id }) => {
	const result = await getRequestEvent().locals.services.records().get(collection, id);

	if (result.isErr()) {
		if (result.error.code === 6006) {
			error(404, 'Collection not found');
		}

		fail(result.error);
	}

	return result.value;
});

/** Records of a collection to choose from in a relation field. */
export const listRelationOptions = query(z.string(), async (collectionId) => {
	const result = await getRequestEvent().locals.services.records().listOptions(collectionId);

	if (result.isErr()) {
		fail(result.error);
	}

	return result.value;
});

export const saveRecord = form('unchecked', async (data: SaveRecordInput, issue) => {
	const { services } = requireUser();
	const values = data.values ?? {};

	if (data.collection === FILES_COLLECTION) {
		return saveFile(data, values, issue);
	}

	const password = data._password?.trim() ? data._password : undefined;

	// Check the password before saving, so an invalid one doesn't leave a half-saved user.
	if (password && data.collection === USERS_COLLECTION) {
		const parsed = appPassword.safeParse(password);

		if (!parsed.success) {
			invalid(issue._password(parsed.error.issues[0]?.message ?? 'Invalid password'));
		}
	}

	const uploaded = await storeUploads(data, values, issue);

	const result = data.id
		? await services.records().update(data.collection, data.id, values)
		: await services.records().create(data.collection, values);

	if (result.isErr()) {
		await removeFiles(uploaded);
		failRecordWrite(result.error, issue);
	}

	if (password && data.collection === USERS_COLLECTION) {
		const saved = await services.passwordAuth().setPassword(result.value.id, password);

		if (saved.isErr()) {
			fail(saved.error);
		}
	}

	return { id: result.value.id };
});

/** Edits an image of the `files` collection; the file is replaced with the result. */
export const editImage = command(imageEditsSchema, async ({ id, edits }) => {
	const { services } = requireUser();

	const result = await services.files().edit(id, edits);

	if (result.isErr()) {
		switch (result.error.code) {
			case 13003:
				error(404, 'File not found');
				break;
			case 13007:
				error(400, 'Only PNG, JPEG, GIF and WebP images can be edited');
				break;
			case 13001:
				error(400, `The edited image is larger than ${formatFileSize(MAX_FILE_SIZE)}`);
				break;
			case 13008:
				error(400, 'The image could not be edited; it may be too large');
				break;
		}

		fail(result.error);
	}

	return { id };
});

export const deleteRecords = form(deleteRecordsSchema, async (data) => {
	const { services } = requireUser();

	let ids: string[];

	try {
		ids = z.array(z.string()).parse(JSON.parse(data.ids));
	} catch {
		error(400, 'Invalid selection');
	}

	const result = await services.records().delete(data.collection, ids);

	if (result.isErr()) {
		if (result.error.code === 6006) {
			error(404, 'Collection not found');
		}

		if (result.error.code === 8019) {
			const { collection, field } = result.error.data;

			invalid(
				`Records of ${collection} still link to ${ids.length === 1 ? 'this record' : 'these records'} through ${field}. Delete or unlink them first.`
			);
		}

		if (result.error.code === 8021) {
			const { collection, field } = result.error.data;

			invalid(
				`A record is the default value of ${collection}.${field}. Change that default first.`
			);
		}

		if (result.error.code === 8020) {
			invalid('This would delete too many linked records at once. Delete fewer records.');
		}

		fail(result.error);
	}

	return result.value;
});
