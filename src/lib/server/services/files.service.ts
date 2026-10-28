import type { ContextError, ErrorOf, ServiceError } from './base.service';
import type { Collection, CollectionsService } from './collections.service';
import type { DatabaseService } from './database.service';
import type { CreateFieldInput } from './fields.service';
import type { StorageError } from './storage.service';
import type { ThumbnailSettings } from '#lib/files/thumbnails.js';
import type { ResultAsync } from 'neverthrow';

import { FILES_COLLECTION, INLINE_IMAGE_TYPES, MAX_FILE_SIZE } from '#lib/files/files.js';
import { parseThumbnailSize } from '#lib/files/thumbnails.js';

import { batchDatabase, queryDatabase, queryObjects } from '../db/query';
import { generateRecordId } from '../crypto';
import { canProcess, editImage, type ImageEdits } from '../images';
import { Service } from './base.service';
import { generateThumbnails, openThumbnail, thumbnailKey } from './files-thumbnails';
import { inBackground } from '../platform/runtime';

/** Fields every file has; they are managed by this service and can't be renamed or deleted. */
const FILE_FIELDS: CreateFieldInput[] = [
	{ name: 'name', type: 'text', required: false, unique: false, options: {} },
	{ name: 'mime_type', type: 'text', required: false, unique: false, options: {} },
	{ name: 'size', type: 'integer', required: false, unique: false, options: {} },
	{ name: 'key', type: 'text', required: false, unique: true, options: {} },
	/** JSON array of the thumbnail sizes stored for this file, e.g. `["100x100"]`. */
	{ name: 'thumbnails', type: 'json', required: false, unique: false, options: {} }
];

/** How long importing a remote image (e.g. an OAuth avatar) may take. */
const IMPORT_TIMEOUT = 5000;

const COLUMNS = `"id", "name", "mime_type", "size", "key", "thumbnails"`;

// Once ensured, the files collection stays; cache it per isolate.
let filesCollection: Collection | null = null;

/** Forgets the cached files collection, after the system database was replaced by a restore. */
export function forgetFilesCollection() {
	filesCollection = null;
}

export type StoredFile = {
	id: string;
	name: string;
	mimeType: string;
	size: number;
	key: string;
	/** Thumbnail sizes stored for this file. */
	thumbnails: string[];
};

/** The content to send for a file or one of its thumbnails. */
export type FileContent = {
	file: StoredFile;
	mimeType: string;
	size: number;
	body: ReadableStream | Uint8Array;
};

export type FilesError =
	| ContextError
	| ErrorOf<ReturnType<CollectionsService['ensureSystem']>>
	| ErrorOf<ReturnType<CollectionsService['getSettings']>>
	| ErrorOf<ReturnType<DatabaseService['requireApp']>>
	| StorageError
	| ServiceError<13000, 'FILES_FAILED'>
	| ServiceError<13001, 'FILE_TOO_LARGE'>
	| ServiceError<13002, 'FILE_EMPTY'>
	| ServiceError<13003, 'FILE_NOT_FOUND'>
	| ServiceError<13007, 'NOT_AN_IMAGE'>
	| ServiceError<13008, 'EDIT_FAILED'>;

/** Object key in storage: the record id plus a cleaned-up file name, so downloads keep their name. */
function objectKey(id: string, name: string) {
	const cleaned = name
		.normalize('NFKD')
		.replace(/[^\w.-]+/g, '-')
		.replace(/-+/g, '-')
		.slice(-100);

	return `${id}/${cleaned || 'file'}`;
}

const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

/** The name of an edited image: unchanged, unless it was converted to another format. */
function editedName(name: string, from: string, to: string) {
	if (from.toLowerCase() === to) {
		return name;
	}

	const baseName = name.replace(/\.[^.]+$/, '') || 'image';

	return `${baseName}.${EXTENSIONS[to] ?? to.split('/')[1] ?? 'png'}`;
}

/** Storage keys of a file and all its thumbnails, e.g. to delete them. */
export function storageKeys(file: Pick<StoredFile, 'key' | 'thumbnails'>) {
	return [file.key, ...file.thumbnails.map((spec) => thumbnailKey(file.key, spec))];
}

export function parseThumbnailList(value: unknown): string[] {
	try {
		const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

function toStoredFile(row: Record<string, unknown>): StoredFile {
	return {
		id: String(row.id),
		name: String(row.name ?? 'file'),
		mimeType: String(row.mime_type ?? 'application/octet-stream'),
		size: Number(row.size ?? 0),
		key: String(row.key),
		thumbnails: parseThumbnailList(row.thumbnails)
	};
}

export class FilesService extends Service {
	/** The built-in `files` collection with its system fields. */
	ensureFilesCollection(): ResultAsync<Collection, FilesError> {
		return this.run(async () => {
			filesCollection ??= await this.must(
				this.services.collections().ensureSystem(FILES_COLLECTION, FILE_FIELDS)
			);

			return filesCollection;
		}, this.failed);
	}

	/** Thumbnail settings of the `files` collection (read fresh: they can change at any time). */
	thumbnailSettings(): ResultAsync<ThumbnailSettings, FilesError> {
		return this.run(async () => {
			await this.must(this.ensureFilesCollection());

			const settings = await this.must(this.services.collections().getSettings(FILES_COLLECTION));

			return settings.thumbnails ?? { enabled: false, sizes: [] };
		}, this.failed);
	}

	/**
	 * Stores an upload in object storage and adds it to the `files` collection. When thumbnails are on, they
	 * are generated right away (best effort; missing ones are made on request).
	 */
	create(file: File, name?: string): ResultAsync<StoredFile, FilesError> {
		return this.run(async () => {
			this.check(file);

			const id = generateRecordId();
			const stored: StoredFile = {
				id,
				name: name?.trim() || file.name || 'file',
				mimeType: file.type || 'application/octet-stream',
				size: file.size,
				key: objectKey(id, file.name),
				thumbnails: []
			};
			const databaseId = await this.database();
			const bytes = new Uint8Array(await file.arrayBuffer());
			const storage = this.services.storage();

			await this.must(storage.put(stored.key, bytes.buffer as ArrayBuffer, stored.mimeType));

			const now = Date.now();

			try {
				await queryDatabase(
					databaseId,
					`INSERT INTO "files" ("id", "created_at", "updated_at", "name", "mime_type", "size", "key", "thumbnails") VALUES (?, ?, ?, ?, ?, ?, ?, '[]')`,
					[stored.id, now, now, stored.name, stored.mimeType, stored.size, stored.key]
				);
			} catch (error) {
				// Don't leave an orphaned object behind.
				await storage.delete([stored.key]);
				throw error;
			}

			// Computed fields of `files` (e.g. a slug of the name); best effort.
			await this.services.records().refreshComputed(FILES_COLLECTION, [stored.id]);
			this.changed('create', stored.id);

			return this.withThumbnails(databaseId, stored, bytes);
		}, this.failed);
	}

	/** Replaces the stored file of an existing record; the old object and thumbnails are deleted. */
	replace(id: string, file: File): ResultAsync<StoredFile, FilesError> {
		return this.run(async () => {
			this.check(file);

			const databaseId = await this.database();
			const current = await this.lookup(databaseId, id);

			if (!current) {
				this.fail(13003, 'FILE_NOT_FOUND');
			}

			const stored: StoredFile = {
				...current,
				mimeType: file.type || 'application/octet-stream',
				size: file.size,
				key: objectKey(`${id}-${Date.now()}`, file.name),
				thumbnails: []
			};
			const bytes = new Uint8Array(await file.arrayBuffer());
			const storage = this.services.storage();

			await this.must(storage.put(stored.key, bytes.buffer as ArrayBuffer, stored.mimeType));
			await queryDatabase(
				databaseId,
				`UPDATE "files" SET "mime_type" = ?, "size" = ?, "key" = ?, "thumbnails" = '[]', "updated_at" = ? WHERE "id" = ?`,
				[stored.mimeType, stored.size, stored.key, Date.now(), id]
			);
			this.changed('update', id);

			// The new file is saved; failing to clean up the old one isn't fatal.
			await storage.delete(storageKeys(current));

			return this.withThumbnails(databaseId, stored, bytes);
		}, this.failed);
	}

	/**
	 * Edits an image (crop, rotate, resize, ...) with Photon and replaces the stored file with the
	 * result. Its thumbnails are regenerated.
	 */
	edit(id: string, edits: ImageEdits): ResultAsync<StoredFile, FilesError> {
		return this.run(async () => {
			const databaseId = await this.database();
			const current = await this.lookup(databaseId, id);

			if (!current) {
				this.fail(13003, 'FILE_NOT_FOUND');
			}

			if (!canProcess(current.mimeType)) {
				this.fail(13007, 'NOT_AN_IMAGE');
			}

			const original = await this.must(this.services.storage().get(current.key));

			if (!original) {
				this.fail(13003, 'FILE_NOT_FOUND');
			}

			const file = await this.editedFile(current, original, edits);
			const stored = await this.must(this.replace(id, file));

			if (file.name === current.name) {
				return stored;
			}

			// Converted to another format: the name gets the matching extension.
			await queryDatabase(databaseId, `UPDATE "files" SET "name" = ? WHERE "id" = ?`, [
				file.name,
				id
			]);
			this.changed('update', id);

			return { ...stored, name: file.name };
		}, this.failed);
	}

	/**
	 * Downloads an image (e.g. an OAuth avatar) and stores it as a file.
	 * Returns `null` when the URL doesn't point to a usable image.
	 */
	importImage(url: string, name: string): ResultAsync<StoredFile | null, FilesError> {
		return this.run(async () => {
			const response = await fetch(url, { signal: AbortSignal.timeout(IMPORT_TIMEOUT) });
			const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';

			if (!response.ok || !type.startsWith('image/')) {
				return null;
			}

			const extension = type.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'img';
			const file = new File([await response.arrayBuffer()], `${name}.${extension}`, { type });

			return file.size <= MAX_FILE_SIZE ? this.must(this.create(file)) : null;
		}, this.failed);
	}

	/** A file record, or `null` when it doesn't exist. */
	find(id: string): ResultAsync<StoredFile | null, FilesError> {
		return this.run(async () => this.lookup(await this.database(), id), this.failed);
	}

	/**
	 * A file's content, or one of its thumbnails (`thumb`, e.g. `100x100`). A thumbnail is only
	 * served for a configured size; when it doesn't exist yet it is generated and stored. In every
	 * other case (thumbnails off, unknown size, not an image) the original is served.
	 * Returns `null` when the file doesn't exist.
	 */
	open(id: string, thumb?: string | null): ResultAsync<FileContent | null, FilesError> {
		return this.run(async () => {
			const databaseId = await this.database();
			const file = await this.lookup(databaseId, id);

			if (!file) {
				return null;
			}

			const storage = this.services.storage();
			const size = thumb ? parseThumbnailSize(thumb) : null;

			if (size && canProcess(file.mimeType)) {
				const settings = await this.must(this.thumbnailSettings());

				if (settings.enabled && settings.sizes.includes(size.spec)) {
					const content = await openThumbnail(storage, databaseId, file, size.spec);

					if (content) {
						return content;
					}
				}
			}

			const original = await this.must(storage.get(file.key));

			return original?.body
				? { file, mimeType: file.mimeType, size: file.size, body: original.body }
				: null;
		}, this.failed);
	}

	/**
	 * The newest images that can be shown inline (PNG, JPEG, GIF, WebP, AVIF), e.g. to pick one
	 * for an email. `search` matches part of the name.
	 */
	listImages(search: string, limit: number): ResultAsync<StoredFile[], FilesError> {
		const types = [...INLINE_IMAGE_TYPES];
		const pattern = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

		return this.run(async () => {
			const rows = await queryObjects(
				await this.database(),
				`SELECT ${COLUMNS} FROM "files" WHERE "key" IS NOT NULL AND lower("mime_type") IN (${types.map(() => '?').join(', ')}) AND "name" LIKE ? ESCAPE '\\' ORDER BY "created_at" DESC LIMIT ?`,
				[...types, pattern, limit]
			);

			return rows.map(toStoredFile);
		}, this.failed);
	}

	/**
	 * Walks all files in id order, e.g. to copy them to other storage: up to `limit` files after
	 * `after`, plus how many files there are and how many come at or before `after`.
	 */
	scan(
		after: string | null,
		limit: number
	): ResultAsync<{ files: StoredFile[]; total: number; done: number }, FilesError> {
		const cursor = after ?? '';

		return this.run(async () => {
			const [[total], [done], rows] = await batchDatabase(await this.database(), [
				{ sql: `SELECT COUNT(*) FROM "files"` },
				{ sql: `SELECT COUNT(*) FROM "files" WHERE "id" <= ?`, params: [cursor] },
				{
					sql: `SELECT ${COLUMNS} FROM "files" WHERE "id" > ? AND "key" IS NOT NULL ORDER BY "id" LIMIT ?`,
					params: [cursor, limit]
				}
			]);

			return {
				total: Number(total?.[0] ?? 0),
				done: Number(done?.[0] ?? 0),
				files: rows.map(([id, name, mimeType, size, key, thumbnails]) =>
					toStoredFile({ id, name, mime_type: mimeType, size, key, thumbnails })
				)
			};
		}, this.failed);
	}

	private failed = (error: unknown) => this.error(13000, 'FILES_FAILED', error);

	/** The app database, with the `files` collection in it. */
	private async database() {
		await this.must(this.ensureFilesCollection());

		const { id } = await this.must(this.services.database().requireApp());

		return id;
	}

	private async lookup(databaseId: string, id: string) {
		const [row] = await queryObjects(databaseId, `SELECT ${COLUMNS} FROM "files" WHERE "id" = ?`, [
			id
		]);

		return row?.key ? toStoredFile(row) : null;
	}

	/** The image with the edits applied, as a file to replace the original with. */
	private async editedFile(current: StoredFile, original: Response, edits: ImageEdits) {
		try {
			const result = editImage(
				new Uint8Array(await original.arrayBuffer()),
				current.mimeType,
				edits
			);

			return new File(
				[result.bytes as Uint8Array<ArrayBuffer>],
				editedName(current.name, current.mimeType, result.mimeType),
				{ type: result.mimeType }
			);
		} catch (error) {
			this.fail(13008, 'EDIT_FAILED', { cause: error });
		}
	}

	/** Generates the configured thumbnails of an image. Best effort: never fails the upload. */
	private async withThumbnails(databaseId: string, file: StoredFile, bytes: Uint8Array) {
		if (!canProcess(file.mimeType)) {
			return file;
		}

		const settings = await this.thumbnailSettings();

		if (settings.isOk() && settings.value.enabled && settings.value.sizes.length) {
			await generateThumbnails(
				this.services.storage(),
				databaseId,
				file,
				bytes,
				settings.value.sizes
			);
		}

		return file;
	}

	/** Sends the realtime event of a file this service wrote directly. */
	private changed(action: 'create' | 'update', id: string) {
		inBackground(this.services.records().announceStored(FILES_COLLECTION, action, [id]));
	}

	private check(file: File) {
		if (!file.size) {
			this.fail(13002, 'FILE_EMPTY');
		}

		if (file.size > MAX_FILE_SIZE) {
			this.fail(13001, 'FILE_TOO_LARGE');
		}
	}
}
