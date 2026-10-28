import type { DatabaseFile } from '#lib/backups/archive.js';
import type { ObjectStore } from '../../platform';
import type { backupDestinations, backupRestores, backups, backupSchedules } from '../../db';

import { createS3Storage } from '../../platform';

/**
 * The rows and step states of backups and restores. In the destination, every backup is a folder
 * `<prefix>/<timestamp>-<random>/` with `system.sql`, `app.sql` (D1 dumps) and `manifest.json`.
 * Uploaded files are copied once to `<prefix>/files/<storage key>`, shared by all backups:
 * uploads never change, so a backup only copies the new ones, and files are never removed there,
 * so every backup can be restored.
 */

export const MANIFEST_FORMAT = 1;

/** Failed attempts of a step before the job fails. */
export const MAX_ATTEMPTS = 5;

/** Objects copied per step at most (subrequest limit of Workers). */
export const OBJECTS_PER_STEP = 12;

const NAME_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export type Destination = typeof backupDestinations.$inferSelect;
export type ScheduleRow = typeof backupSchedules.$inferSelect;
export type BackupRow = typeof backups.$inferSelect;
export type RestoreRow = typeof backupRestores.$inferSelect;

export type BackupState =
	| { step: 'export'; database: 'system' | 'app'; bookmark: string | null }
	| { step: 'files'; cursor: string | null }
	| { step: 'finish' }
	| {
			step: 'upload';
			manifest: Manifest;
			/** The multipart upload of each database file. */
			files: Partial<Record<DatabaseFile, UploadedFile>>;
			updatedAt: number;
	  };

type UploadedFile = { uploadId: string; etags: string[]; size: number; done: boolean };

export type UploadState = Extract<BackupState, { step: 'upload' }>;

/** A database the backup is restored into before it becomes the app database. */
export type SpareDatabase = { id: string; name: string };

/**
 * The app dump is loaded into a new database while the app keeps using the current one; restoring
 * the system database then switches to it, in the same transaction.
 */
export type RestoreState = (
	| { step: 'app' }
	| { step: 'import'; database: SpareDatabase; bookmark: string | null }
	| { step: 'load'; database: SpareDatabase; offset: number; size: number }
	| { step: 'system'; database: SpareDatabase }
	| { step: 'files'; cursor: string | null }
	| { step: 'done' }
) & {
	/** The app database this restore replaced; deleted by the tick after a while. */
	retire?: { id: string; at: number };
};

export type Manifest = {
	format: number;
	createdAt: string;
	includeFiles: boolean;
	size: number;
	files: number;
};

/** A destination as shown on the Backups page; the secret key never leaves the server. */
export type DestinationSummary = Omit<Destination, 'secretAccessKey' | 'createdAt'> & {
	hasSecretAccessKey: boolean;
};

export type SaveDestinationInput = Omit<Destination, 'id' | 'secretAccessKey' | 'createdAt'> & {
	/** Empty for a new destination. */
	id: string;
	/** Empty keeps the stored secret. */
	secretAccessKey?: string;
};

export type ScheduleSummary = Omit<ScheduleRow, 'createdAt'> & { destinationName: string };

export type SaveScheduleInput = {
	/** Empty for a new schedule. */
	id: string;
	destinationId: string;
	cron: string;
	includeFiles: boolean;
	keep: number;
	enabled: boolean;
};

export type JobStatus = BackupRow['status'];

export type BackupSummary = {
	id: string;
	destinationId: string;
	destinationName: string;
	scheduled: boolean;
	status: JobStatus;
	/** What a running backup is doing. */
	step: string | null;
	includeFiles: boolean;
	size: number;
	files: number;
	error: string | null;
	startedAt: Date;
	finishedAt: Date | null;
};

export type RestoreSummary = {
	id: string;
	/** When the restored backup was made; `null` when it was deleted since. */
	backupStartedAt: Date | null;
	status: JobStatus;
	step: string | null;
	includeFiles: boolean;
	files: number;
	error: string | null;
	startedAt: Date;
	finishedAt: Date | null;
};

function randomSuffix(length: number) {
	const bytes = crypto.getRandomValues(new Uint8Array(length));

	return Array.from(bytes, (byte) => NAME_ALPHABET[byte % NAME_ALPHABET.length]).join('');
}

/** A date as it appears in keys and filenames, e.g. `2026-10-23T03-00-00Z`. */
export function stamp(date: Date) {
	return date
		.toISOString()
		.replace(/\.\d{3}Z$/, 'Z')
		.replace(/:/g, '-');
}

/** Folder of a new backup, e.g. `pouchbase/2026-10-23T03-00-00Z-k3x9`; sorts by date. */
export function backupKey(prefix: string, date: Date) {
	return `${prefix}/${stamp(date)}-${randomSuffix(4)}`;
}

export function parseState<T>(value: string, fallback: T): T {
	try {
		const parsed = JSON.parse(value) as T & { step?: string };

		return parsed?.step ? parsed : fallback;
	} catch {
		return fallback;
	}
}

export function backupState(backup: BackupRow): BackupState {
	return parseState(backup.state, { step: 'export', database: 'system', bookmark: null });
}

export function restoreState(restore: RestoreRow): RestoreState {
	return parseState(restore.state, { step: 'app' });
}

/** What a running backup is doing, for the Backups page. */
export function describeBackupStep(state: BackupState) {
	switch (state.step) {
		case 'export':
			return state.database === 'system'
				? 'Exporting the system database'
				: 'Exporting the app database';
		case 'files':
			return 'Copying files';
		case 'finish':
			return 'Finishing';
		case 'upload':
			return 'Uploading';
	}
}

export function describeRestoreStep(state: RestoreState) {
	switch (state.step) {
		case 'app':
			return 'Preparing a new app database';
		case 'import':
			return 'Importing the app database';
		case 'load':
			return `Loading the app database (${Math.floor((state.offset / Math.max(1, state.size)) * 100)}%)`;
		case 'system':
			return 'Restoring the system database';
		case 'files':
			return 'Restoring files';
		case 'done':
			return 'Finishing';
	}
}

/** The manifest in `value`, normalised; `null` when it isn't one. */
export function parseManifest(value: unknown): Manifest | null {
	const manifest = value as Partial<Manifest> | null;

	if (
		!manifest ||
		typeof manifest !== 'object' ||
		manifest.format !== MANIFEST_FORMAT ||
		typeof manifest.createdAt !== 'string' ||
		Number.isNaN(Date.parse(manifest.createdAt))
	) {
		return null;
	}

	return {
		format: MANIFEST_FORMAT,
		createdAt: new Date(manifest.createdAt).toISOString(),
		includeFiles: !!manifest.includeFiles,
		size: Number(manifest.size) || 0,
		files: Number(manifest.files) || 0
	};
}

/** The bucket of a destination. */
export function store(destination: Destination): ObjectStore {
	return createS3Storage({
		endpoint: destination.endpoint,
		region: destination.region,
		accessKeyId: destination.accessKeyId,
		secretAccessKey: destination.secretAccessKey,
		pathStyle: destination.pathStyle
	});
}

/** Writes `manifest.json` of a backup. */
export function putManifest(
	target: ObjectStore,
	destination: Destination,
	key: string,
	manifest: Manifest
) {
	return target.putObject(
		destination.bucket,
		`${key}/manifest.json`,
		new TextEncoder().encode(JSON.stringify(manifest, null, '\t')).buffer as ArrayBuffer,
		'application/json'
	);
}

export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The row without one of its columns, e.g. the `createdAt` the page doesn't show. */
export function without<T extends object, K extends keyof T>(row: T, key: K): Omit<T, K> {
	const copy = { ...row };

	delete copy[key];

	return copy;
}
