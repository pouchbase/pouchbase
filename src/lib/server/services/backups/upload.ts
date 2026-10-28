import type { DatabaseFile } from '#lib/backups/archive.js';
import type { BackupRow, BackupState, Destination, Manifest, UploadState } from './state';

import { eq } from 'drizzle-orm';

import { DATABASE_FILES } from '#lib/backups/archive.js';

import { backups, db } from '../../db';
import { Failure } from '../base.service';
import { backupKey, parseState, putManifest, store } from './state';

/**
 * Uploading a downloaded backup (a tar archive, see `#lib/backups/archive`) to a destination: the
 * Backups page starts it with the manifest, sends the database files in parts (a multipart upload
 * each, so no request comes near the body size limit) and finishes it. Every function throws.
 */

/** An upload without progress for this long is given up. */
const UPLOAD_TIMEOUT = 24 * 60 * 60 * 1000;

export type Upload = { backup: BackupRow; destination: Destination; state: UploadState };

function notActive() {
	return new Failure({ code: 16011, message: 'UPLOAD_NOT_ACTIVE' });
}

/** Records a new upload; returns the backup id. */
export async function createUpload(destination: Destination, manifest: Manifest) {
	const id = crypto.randomUUID();
	const createdAt = new Date(manifest.createdAt);
	const state: UploadState = { step: 'upload', manifest, files: {}, updatedAt: Date.now() };

	await db.insert(backups).values({
		id,
		destinationId: destination.id,
		key: backupKey(destination.prefix, createdAt),
		status: 'uploading',
		// Archives have no files; those are only restored from a destination.
		includeFiles: false,
		state: JSON.stringify(state),
		startedAt: createdAt
	});

	return id;
}

/** The upload state of a backup row; a failure when it isn't being uploaded. */
export function uploadOf(backup: BackupRow, destination: Destination): Upload {
	const state = parseState<BackupState>(backup.state, { step: 'finish' });

	if (backup.status !== 'uploading' || state.step !== 'upload') {
		throw notActive();
	}

	return { backup, destination, state };
}

/**
 * Uploads part `part` (from 1, in order, at least 5 MiB except the last) of a database file. Part
 * 1 starts the file over.
 */
export async function uploadPart(
	{ backup, destination, state }: Upload,
	file: DatabaseFile,
	part: number,
	body: Uint8Array<ArrayBuffer>,
	last: boolean
) {
	const current = state.files[file];

	if (part !== 1 && (!current || current.done || current.etags.length !== part - 1)) {
		throw notActive();
	}

	const target = store(destination);
	const key = `${backup.key}/${file}`;
	let entry = current;

	if (part === 1) {
		if (current && !current.done) {
			await target.abortMultipart(destination.bucket, key, current.uploadId).catch(() => undefined);
		}

		entry = {
			uploadId: await target.startMultipart(destination.bucket, key, 'application/sql'),
			etags: [],
			size: 0,
			done: false
		};
	}

	if (!entry) {
		throw notActive();
	}

	entry.etags.push(await target.uploadPart(destination.bucket, key, entry.uploadId, part, body));
	entry.size += body.byteLength;

	if (last) {
		await target.completeMultipart(destination.bucket, key, entry.uploadId, entry.etags);
		entry.done = true;
	}

	await db
		.update(backups)
		.set({
			state: JSON.stringify({
				...state,
				files: { ...state.files, [file]: entry },
				updatedAt: Date.now()
			})
		})
		.where(eq(backups.id, backup.id));
}

/** Completes an upload once both database files are uploaded: it can be restored then. */
export async function finishUpload({ backup, destination, state }: Upload) {
	const files = DATABASE_FILES.map((file) => state.files[file]);

	if (files.some((file) => !file?.done)) {
		throw notActive();
	}

	const size = files.reduce((total, file) => total + (file?.size ?? 0), 0);
	const manifest: Manifest = { ...state.manifest, includeFiles: false, size, files: 0 };

	await putManifest(store(destination), destination, backup.key, manifest);
	await db
		.update(backups)
		.set({
			status: 'completed',
			size,
			state: JSON.stringify({ step: 'finish' }),
			finishedAt: new Date()
		})
		.where(eq(backups.id, backup.id));
}

/** Uploads that stopped making progress fail, so they don't stay in the list as uploading. */
export async function expireUploads() {
	const uploads = await db
		.select({ id: backups.id, state: backups.state })
		.from(backups)
		.where(eq(backups.status, 'uploading'));

	for (const upload of uploads) {
		const state = parseState<BackupState>(upload.state, { step: 'finish' });
		const updatedAt = state.step === 'upload' ? state.updatedAt : 0;

		if (Date.now() - updatedAt > UPLOAD_TIMEOUT) {
			await db
				.update(backups)
				.set({ status: 'failed', error: 'The upload was not finished', finishedAt: new Date() })
				.where(eq(backups.id, upload.id));
		}
	}
}
