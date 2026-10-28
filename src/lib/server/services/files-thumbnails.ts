import type { AnyServiceError } from './base.service';
import type { FileContent, StoredFile } from './files.service';
import type { StorageService } from './storage.service';
import type { ResultAsync } from 'neverthrow';

import { parseThumbnailSize } from '#lib/files/thumbnails.js';

import { queryDatabase } from '../db/query';
import { thumbnail } from '../images';
import { Failure } from './base.service';

/**
 * Thumbnails of the images in the `files` collection, for `FilesService`. They are stored next to
 * the original (`thumbs/<key>/<size>`) and listed in the file's `thumbnails` field. These functions
 * throw; the service turns that into its result.
 */

/** Thumbnails live next to the original, under its (unique) key. */
export function thumbnailKey(fileKey: string, spec: string) {
	return `thumbs/${fileKey}/${spec}`;
}

/** The value of a storage result; its error is thrown as the `Failure` of the calling method. */
async function must<T>(result: ResultAsync<T, AnyServiceError>): Promise<T> {
	const settled = await result;

	if (settled.isErr()) {
		throw new Failure(settled.error);
	}

	return settled.value;
}

/**
 * The thumbnail `spec` of an image. When it doesn't exist yet it is made from the original,
 * stored and served. `null` when the original is gone too.
 */
export async function openThumbnail(
	storage: StorageService,
	databaseId: string,
	file: StoredFile,
	spec: string
): Promise<FileContent | null> {
	const stored = await must(storage.get(thumbnailKey(file.key, spec)));

	if (stored?.body) {
		return {
			file,
			mimeType: stored.headers.get('content-type') ?? file.mimeType,
			size: Number(stored.headers.get('content-length') ?? 0),
			body: stored.body as ReadableStream
		};
	}

	// Not generated yet: make it now, store it, and serve it.
	const source = await must(storage.get(file.key));
	const generated = source ? await storeThumbnail(storage, databaseId, file, spec, source) : null;

	return generated
		? { file, mimeType: generated.mimeType, size: generated.bytes.length, body: generated.bytes }
		: null;
}

/** Makes the thumbnails `specs` of a new upload. Best effort: a failed one is made on request. */
export async function generateThumbnails(
	storage: StorageService,
	databaseId: string,
	file: StoredFile,
	bytes: Uint8Array,
	specs: string[]
) {
	for (const spec of specs) {
		try {
			await storeThumbnail(
				storage,
				databaseId,
				file,
				spec,
				new Response(bytes as Uint8Array<ArrayBuffer>)
			);
		} catch {
			// Made when it is first requested.
		}
	}
}

/** Makes one thumbnail from the original, stores it and records its size on the file. */
async function storeThumbnail(
	storage: StorageService,
	databaseId: string,
	file: StoredFile,
	spec: string,
	source: Response
) {
	const size = parseThumbnailSize(spec);

	if (!size) {
		return null;
	}

	const generated = thumbnail(new Uint8Array(await source.arrayBuffer()), file.mimeType, size);

	await must(
		storage.put(
			thumbnailKey(file.key, size.spec),
			generated.bytes.buffer as ArrayBuffer,
			generated.mimeType
		)
	);

	// Appends the size unless it is already listed (two requests can race).
	await queryDatabase(
		databaseId,
		`UPDATE "files" SET "thumbnails" = json_insert(coalesce("thumbnails", '[]'), '$[#]', ?) WHERE "id" = ? AND NOT EXISTS (SELECT 1 FROM json_each(coalesce("thumbnails", '[]')) WHERE value = ?)`,
		[size.spec, file.id, size.spec]
	);

	file.thumbnails = [...new Set([...file.thumbnails, size.spec])];

	return generated;
}
