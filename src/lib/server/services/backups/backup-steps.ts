import type { BackupRow, BackupState, Destination, Manifest, ScheduleRow } from './state';
import type { ObjectStore } from '../../platform';
import type { Services } from '../services';

import { and, desc, eq, sql } from 'drizzle-orm';

import { ARCHIVE_FILES, tarEnd, tarHeader, tarPadding } from '#lib/backups/archive.js';
import { nextRun, parseCron } from '#lib/backups/cron.js';

import { backupDestinations, backupFiles, backups, backupSchedules, db } from '../../db';
import { exportDatabase, getDatabaseId } from '../../db/query';
import { describeError } from '../../errors';
import { runJobStep, StepError, stepResult } from '../../jobs';
import { storageKeys } from '../files.service';
import {
	backupState,
	MANIFEST_FORMAT,
	MAX_ATTEMPTS,
	OBJECTS_PER_STEP,
	parseState,
	putManifest,
	sleep,
	store
} from './state';

/**
 * The steps of a backup: export the system database, export the app database, copy the uploaded
 * files that aren't in the destination yet, write the manifest. Every function throws; the job
 * runner records what went wrong.
 */

/** Files read per step. */
const FILES_PER_STEP = 200;

/** Polls of a database export within one step, before trying again in the next. */
const EXPORT_POLLS = 3;

/** Old backups of a schedule deleted per finished backup at most. */
const PRUNE_PER_STEP = 5;

/** Backups imported from a destination per call at most. */
export const DISCOVER_LIMIT = 40;

type Outcome = { state?: BackupState; size?: number; files?: number; done?: boolean };

/** Runs the step a backup is at and saves the result on its row. */
export async function runBackupStep(services: Services, backup: BackupRow) {
	const state = backupState(backup);

	await runJobStep(
		backup,
		{ label: `backup ${backup.id} (${state.step})`, maxAttempts: MAX_ATTEMPTS },
		async () => {
			const [destination] = await db
				.select()
				.from(backupDestinations)
				.where(eq(backupDestinations.id, backup.destinationId));

			if (!destination) {
				throw new StepError('The destination was deleted');
			}

			const result = await backupStep(services, backup, destination, state);

			return {
				values: {
					state: JSON.stringify(result.state ?? state),
					size: backup.size + (result.size ?? 0),
					files: backup.files + (result.files ?? 0)
				},
				done: result.done
			};
		},
		(values) => db.update(backups).set(values).where(eq(backups.id, backup.id))
	);
}

async function backupStep(
	services: Services,
	backup: BackupRow,
	destination: Destination,
	state: BackupState
): Promise<Outcome> {
	const target = store(destination);

	if (state.step === 'export') {
		return exportStep(services, backup, destination, target, state);
	}

	if (state.step === 'files') {
		return copyFiles(services, destination, target, state.cursor);
	}

	const manifest: Manifest = {
		format: MANIFEST_FORMAT,
		createdAt: backup.startedAt.toISOString(),
		includeFiles: backup.includeFiles,
		size: backup.size,
		files: backup.files
	};

	await putManifest(target, destination, backup.key, manifest);

	if (backup.scheduleId) {
		await prune(backup.scheduleId, destination);
	}

	return { done: true };
}

/** Exports one database as a SQL dump into the destination, once D1 has it ready. */
async function exportStep(
	services: Services,
	backup: BackupRow,
	destination: Destination,
	target: ObjectStore,
	state: Extract<BackupState, { step: 'export' }>
): Promise<Outcome> {
	const databaseId =
		state.database === 'system'
			? await getDatabaseId()
			: (await stepResult(services.database().requireApp())).id;

	if (!databaseId) {
		throw new StepError('The system database is missing');
	}

	let { bookmark } = state;
	let url: string | null = null;

	for (let poll = 0; poll < EXPORT_POLLS && !url; poll++) {
		if (poll > 0) {
			await sleep(2000);
		}

		({ bookmark, url } = await exportDatabase(databaseId, bookmark));
	}

	if (!url) {
		return { state: { ...state, bookmark } };
	}

	const download = await fetch(url);

	if (!download.ok || !download.body) {
		throw new StepError(`Downloading the export failed (${download.status})`);
	}

	const size = await target.putStream(
		destination.bucket,
		`${backup.key}/${state.database}.sql`,
		download.body,
		'application/sql'
	);

	if (state.database === 'system') {
		return { state: { step: 'export', database: 'app', bookmark: null }, size };
	}

	return {
		state: backup.includeFiles ? { step: 'files', cursor: null } : { step: 'finish' },
		size
	};
}

/** Copies the files that aren't in the destination yet, in the order of their ids. */
async function copyFiles(
	services: Services,
	destination: Destination,
	target: ObjectStore,
	cursor: string | null
): Promise<Outcome> {
	const scan = await stepResult(services.files().scan(cursor, FILES_PER_STEP));
	const keys = scan.files.flatMap((file) => storageKeys(file));
	const copied = new Set(
		keys.length
			? (
					await db
						.select({ key: backupFiles.key })
						.from(backupFiles)
						.where(
							and(
								eq(backupFiles.destinationId, destination.id),
								sql`${backupFiles.key} IN (SELECT "value" FROM json_each(${JSON.stringify(keys)}))`
							)
						)
				).map(({ key }) => key)
			: []
	);
	const storage = services.storage();
	const written: string[] = [];
	let files = 0;
	let handled = 0;

	for (const file of scan.files) {
		const missing = storageKeys(file).filter((key) => !copied.has(key));

		if (written.length > 0 && written.length + missing.length > OBJECTS_PER_STEP) {
			break;
		}

		for (const key of missing) {
			const object = await stepResult(storage.get(key));

			// Gone from the storage; nothing to back up.
			if (!object?.body) {
				continue;
			}

			await target.putStream(
				destination.bucket,
				`${destination.prefix}/files/${key}`,
				object.body,
				object.headers.get('content-type') ?? file.mimeType
			);
			written.push(key);
		}

		if (missing.length) {
			files++;
		}

		handled++;
	}

	if (written.length) {
		await db
			.insert(backupFiles)
			.values(written.map((key) => ({ destinationId: destination.id, key })))
			.onConflictDoNothing();
	}

	const finished = handled === scan.files.length && scan.files.length < FILES_PER_STEP;

	return {
		state: finished
			? { step: 'finish' }
			: { step: 'files', cursor: scan.files[handled - 1]?.id ?? cursor },
		files
	};
}

/** Deletes the oldest backups of a schedule beyond the number it keeps. */
async function prune(scheduleId: string, destination: Destination) {
	const [schedule] = await db
		.select({ keep: backupSchedules.keep })
		.from(backupSchedules)
		.where(eq(backupSchedules.id, scheduleId));

	if (!schedule || schedule.keep === 0) {
		return;
	}

	const old = await db
		.select()
		.from(backups)
		.where(and(eq(backups.scheduleId, scheduleId), eq(backups.status, 'completed')))
		.orderBy(desc(backups.startedAt))
		.limit(PRUNE_PER_STEP)
		// The backup that just finished is still `running`, so it counts as one of `keep`.
		.offset(Math.max(0, schedule.keep - 1));

	for (const backup of old) {
		await removeBackup(backup, destination);
	}
}

/** Deletes a backup from its destination and from the list. */
export async function removeBackup(backup: BackupRow, destination: Destination) {
	const target = store(destination);
	const state = parseState<BackupState>(backup.state, { step: 'finish' });

	// An unfinished upload keeps its parts in the bucket until it is aborted.
	if (state.step === 'upload') {
		for (const [file, upload] of Object.entries(state.files)) {
			if (upload && !upload.done) {
				await target
					.abortMultipart(destination.bucket, `${backup.key}/${file}`, upload.uploadId)
					.catch(() => undefined);
			}
		}
	}

	await Promise.all(
		ARCHIVE_FILES.map((file) => target.deleteObject(destination.bucket, `${backup.key}/${file}`))
	);
	await db.delete(backups).where(eq(backups.id, backup.id));
}

/**
 * Adds the backups in a destination that aren't in the list yet, e.g. those of an earlier
 * installation. Returns how many were added, at most `DISCOVER_LIMIT`.
 */
export async function importBackups(destination: Destination) {
	const target = store(destination);
	const folders = await target.listFolders(destination.bucket, `${destination.prefix}/`);
	const known = new Set(
		(
			await db
				.select({ key: backups.key })
				.from(backups)
				.where(eq(backups.destinationId, destination.id))
		).map(({ key }) => key)
	);
	const candidates = folders
		.map((folder) => folder.replace(/\/$/, ''))
		.filter((key) => key !== `${destination.prefix}/files` && !known.has(key))
		.slice(0, DISCOVER_LIMIT);
	let added = 0;

	for (const key of candidates) {
		const object = await target.getObject(destination.bucket, `${key}/manifest.json`);
		const manifest = object ? ((await object.json().catch(() => null)) as Manifest | null) : null;

		// Not a (finished) backup.
		if (!manifest || manifest.format !== MANIFEST_FORMAT || !Date.parse(manifest.createdAt)) {
			continue;
		}

		await db.insert(backups).values({
			destinationId: destination.id,
			key,
			status: 'completed',
			includeFiles: !!manifest.includeFiles,
			size: Number(manifest.size) || 0,
			files: Number(manifest.files) || 0,
			state: JSON.stringify({ step: 'finish' }),
			startedAt: new Date(manifest.createdAt),
			finishedAt: new Date(manifest.createdAt)
		});
		added++;
	}

	return added;
}

/**
 * Starts the backup of a schedule that is due. The run is claimed by moving `next_run_at`: an
 * overlapping tick finds it changed and starts nothing. Skipped while the previous run of the
 * schedule (or a restore) is still running; the next run comes as planned.
 */
export async function startScheduled(services: Services, schedule: ScheduleRow, now: Date) {
	const cron = parseCron(schedule.cron);
	const next = (cron && nextRun(cron, now)) ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);
	const claimed = await db
		.update(backupSchedules)
		.set({ nextRunAt: next, lastRunAt: now })
		.where(
			and(eq(backupSchedules.id, schedule.id), eq(backupSchedules.nextRunAt, schedule.nextRunAt))
		)
		.returning({ id: backupSchedules.id });

	if (!claimed.length) {
		return;
	}

	const [busy] = await db
		.select({ id: backups.id })
		.from(backups)
		.where(and(eq(backups.scheduleId, schedule.id), eq(backups.status, 'running')))
		.limit(1);

	if (busy) {
		return;
	}

	const started = await services
		.backups()
		.start(schedule.destinationId, schedule.includeFiles, schedule.id);

	if (started.isErr()) {
		console.warn(`[backups] scheduled backup not started: ${describeError(started.error)}`);
	}
}

/** The SQL dumps and manifest of a backup, as streams from the destination. */
export async function archiveFiles(backup: BackupRow, destination: Destination) {
	const source = store(destination);

	return Promise.all(
		ARCHIVE_FILES.map(async (name) => {
			const object = await source.getObject(destination.bucket, `${backup.key}/${name}`);
			const size = Number(object?.headers.get('content-length'));

			if (!object?.body || Number.isNaN(size)) {
				throw new StepError(`${backup.key}/${name} is missing in the destination`);
			}

			return { name, size, body: object.body };
		})
	);
}

/** Writes a chunk to a stream that other writes and pipes also use. */
async function write(writable: WritableStream<Uint8Array>, chunk: Uint8Array) {
	const writer = writable.getWriter();

	try {
		await writer.write(chunk);
	} finally {
		writer.releaseLock();
	}
}

/** The files as a tar archive, streamed from their responses (see `#lib/backups/archive`). */
export function archiveStream(
	files: { name: string; size: number; body: ReadableStream<Uint8Array> }[],
	modified: Date
) {
	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

	void (async () => {
		try {
			for (const file of files) {
				await write(writable, tarHeader(file.name, file.size, modified));
				await file.body.pipeTo(writable, { preventClose: true });
				await write(writable, new Uint8Array(tarPadding(file.size)));
			}

			await write(writable, tarEnd());
			await writable.close();
		} catch (error) {
			console.warn(`[backups] download failed: ${describeError(error)}`);
			await Promise.all(files.map((file) => file.body.cancel().catch(() => undefined)));
			await writable.abort(error).catch(() => undefined);
		}
	})();

	return readable;
}
