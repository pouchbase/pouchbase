import type { ServiceError } from './base.service';
import type { DatabaseFile } from '#lib/backups/archive.js';
import type {
	BackupState,
	BackupSummary,
	Destination,
	DestinationSummary,
	RestoreState,
	RestoreSummary,
	SaveDestinationInput,
	SaveScheduleInput,
	ScheduleSummary
} from './backups/state';
import type { ResultAsync } from 'neverthrow';

import { and, asc, desc, eq, lte } from 'drizzle-orm';

import { tarSize } from '#lib/backups/archive.js';
import { nextRun, parseCron } from '#lib/backups/cron.js';

import { backupDestinations, backupRestores, backups, backupSchedules } from '../db';
import { claimJob, describeError } from '../jobs';
import {
	archiveFiles,
	archiveStream,
	importBackups,
	removeBackup,
	runBackupStep,
	startScheduled
} from './backups/backup-steps';
import {
	backupSummary,
	findBackup,
	findDestination,
	isRestoring,
	isRunning,
	restoreSummary,
	testConnection
} from './backups/queries';
import { retireDatabases, runRestoreStep } from './backups/restore-steps';
import { backupKey, parseManifest, stamp, without } from './backups/state';
import { createUpload, expireUploads, finishUpload, uploadOf, uploadPart } from './backups/upload';
import { Failure, Service } from './base.service';

export type {
	BackupSummary,
	DestinationSummary,
	JobStatus,
	RestoreSummary,
	SaveDestinationInput,
	SaveScheduleInput,
	ScheduleSummary
} from './backups/state';

/**
 * Backups of the system and app databases to S3-compatible buckets, made right away or on a
 * schedule, and restores of them (see `./backups/state.ts` for the layout in the bucket).
 *
 * Backups and restores run in steps, so a step stays within the limits of a Worker invocation and
 * an interrupted job continues where it was (see `../jobs.ts`). Steps are run by `advance()`: from
 * the Backups page while it is open, and from `tick()`, which a Cron Trigger (Workers) or a timer
 * (Node) calls every minute (see `src/routes/internal/tick`).
 */

type WithReason = { data: { reason: string } };

type Failed = ServiceError<16000, 'BACKUPS_FAILED'>;
type DestinationNotFound = ServiceError<16001, 'DESTINATION_NOT_FOUND'>;
type ConnectionFailed = ServiceError<16002, 'CONNECTION_FAILED'> & WithReason;
type JobRunning = ServiceError<16003, 'JOB_RUNNING'>;
type BackupNotFound = ServiceError<16004, 'BACKUP_NOT_FOUND'>;
type BackupIncomplete = ServiceError<16005, 'BACKUP_INCOMPLETE'>;
type DeleteFailed = ServiceError<16006, 'DELETE_FAILED'> & WithReason;
type DiscoverFailed = ServiceError<16007, 'DISCOVER_FAILED'> & WithReason;
type InvalidSchedule = ServiceError<16008, 'INVALID_SCHEDULE'>;
type InvalidArchive = ServiceError<16010, 'INVALID_ARCHIVE'>;
type UploadNotActive = ServiceError<16011, 'UPLOAD_NOT_ACTIVE'>;
type TransferFailed = ServiceError<16012, 'TRANSFER_FAILED'> & WithReason;

export type BackupsError =
	| Failed
	| DestinationNotFound
	| ConnectionFailed
	| JobRunning
	| BackupNotFound
	| BackupIncomplete
	| DeleteFailed
	| DiscoverFailed
	| InvalidSchedule
	| InvalidArchive
	| UploadNotActive
	| TransferFailed;

export class BackupsService extends Service {
	destinations(): ResultAsync<DestinationSummary[], Failed> {
		return this.run(async () => {
			const rows = await this.db
				.select()
				.from(backupDestinations)
				.orderBy(asc(backupDestinations.name));

			return rows.map(({ secretAccessKey, ...destination }) => ({
				...without(destination, 'createdAt'),
				hasSecretAccessKey: !!secretAccessKey
			}));
		}, this.failed);
	}

	/**
	 * Creates or updates a destination; it is only saved when a test file can be written to it and
	 * deleted again.
	 */
	saveDestination(
		input: SaveDestinationInput
	): ResultAsync<string, Failed | DestinationNotFound | ConnectionFailed> {
		return this.run(async () => {
			const { id, secretAccessKey, ...fields } = input;
			const existing = id ? await this.requireDestination(id) : null;
			const values = {
				...fields,
				secretAccessKey: secretAccessKey || existing?.secretAccessKey || ''
			};
			const destination: Destination = {
				...values,
				id: id || crypto.randomUUID(),
				createdAt: existing?.createdAt ?? new Date()
			};

			try {
				await testConnection(destination);
			} catch (error) {
				throw new Failure(this.withReason(16002, 'CONNECTION_FAILED', error));
			}

			await this.db
				.insert(backupDestinations)
				.values(destination)
				.onConflictDoUpdate({ target: backupDestinations.id, set: values });

			return destination.id;
		}, this.failed);
	}

	/**
	 * Deletes a destination with its schedules and the list of its backups. The backups themselves
	 * stay in the bucket.
	 */
	deleteDestination(id: string): ResultAsync<void, Failed | JobRunning> {
		return this.run(async () => {
			await this.requireIdle();
			await this.db.delete(backupDestinations).where(eq(backupDestinations.id, id));
		}, this.failed);
	}

	schedules(): ResultAsync<ScheduleSummary[], Failed> {
		return this.run(async () => {
			const rows = await this.db
				.select({ schedule: backupSchedules, destinationName: backupDestinations.name })
				.from(backupSchedules)
				.innerJoin(backupDestinations, eq(backupDestinations.id, backupSchedules.destinationId))
				.orderBy(asc(backupSchedules.createdAt));

			return rows.map(({ schedule, destinationName }) => ({
				...without(schedule, 'createdAt'),
				destinationName
			}));
		}, this.failed);
	}

	saveSchedule(
		input: SaveScheduleInput
	): ResultAsync<void, Failed | DestinationNotFound | InvalidSchedule> {
		return this.run(async () => {
			const cron = parseCron(input.cron);
			const next = cron && nextRun(cron, new Date());

			if (!next) {
				this.fail(16008, 'INVALID_SCHEDULE');
			}

			await this.requireDestination(input.destinationId);

			const values = {
				destinationId: input.destinationId,
				cron: input.cron.trim(),
				includeFiles: input.includeFiles,
				keep: input.keep,
				enabled: input.enabled,
				nextRunAt: next
			};

			if (input.id) {
				await this.db.update(backupSchedules).set(values).where(eq(backupSchedules.id, input.id));
			} else {
				await this.db.insert(backupSchedules).values(values);
			}
		}, this.failed);
	}

	deleteSchedule(id: string): ResultAsync<void, Failed> {
		return this.run(async () => {
			await this.db.delete(backupSchedules).where(eq(backupSchedules.id, id));
		}, this.failed);
	}

	/** The backups, newest first. */
	list(): ResultAsync<BackupSummary[], Failed> {
		return this.run(async () => {
			const rows = await this.db
				.select({ backup: backups, destinationName: backupDestinations.name })
				.from(backups)
				.innerJoin(backupDestinations, eq(backupDestinations.id, backups.destinationId))
				.orderBy(desc(backups.startedAt))
				.limit(200);

			return rows.map(({ backup, destinationName }) => backupSummary(backup, destinationName));
		}, this.failed);
	}

	/** The latest restore, or `null` when there never was one. */
	latestRestore(): ResultAsync<RestoreSummary | null, Failed> {
		return this.run(async () => {
			const [row] = await this.db
				.select({ restore: backupRestores, backupStartedAt: backups.startedAt })
				.from(backupRestores)
				.leftJoin(backups, eq(backups.id, backupRestores.backupId))
				.orderBy(desc(backupRestores.startedAt))
				.limit(1);

			return row ? restoreSummary(row.restore, row.backupStartedAt) : null;
		}, this.failed);
	}

	/** Starts a backup; its steps run with `advance()`. Returns its id. */
	start(
		destinationId: string,
		includeFiles: boolean,
		scheduleId: string | null = null
	): ResultAsync<string, Failed | DestinationNotFound | JobRunning> {
		return this.run(async () => {
			const destination = await this.requireDestination(destinationId);

			if (await isRestoring()) {
				this.fail(16003, 'JOB_RUNNING');
			}

			const id = crypto.randomUUID();
			const state: BackupState = { step: 'export', database: 'system', bookmark: null };

			await this.db.insert(backups).values({
				id,
				destinationId,
				scheduleId,
				key: backupKey(destination.prefix, new Date()),
				includeFiles,
				state: JSON.stringify(state)
			});

			return id;
		}, this.failed);
	}

	/** Deletes a backup from its destination and from the list. */
	delete(id: string): ResultAsync<void, BackupNotFound | JobRunning | DeleteFailed> {
		return this.run(
			async () => {
				const { backup, destination } = await this.requireBackup(id);

				// Uploads can be deleted, e.g. to give up on one.
				if (backup.status === 'running') {
					this.fail(16003, 'JOB_RUNNING');
				}

				await removeBackup(backup, destination);
			},
			(error) => this.withReason(16006, 'DELETE_FAILED', error)
		);
	}

	/**
	 * A completed backup as a tar archive with its manifest and SQL dumps, streamed from the
	 * destination. `null` when there is no such backup. Uploaded files aren't included.
	 */
	archive(
		id: string
	): ResultAsync<
		{ filename: string; size: number; body: ReadableStream<Uint8Array> } | null,
		BackupIncomplete | TransferFailed
	> {
		return this.run(
			async () => {
				const row = await findBackup(id);

				if (!row) {
					return null;
				}

				if (row.backup.status !== 'completed') {
					this.fail(16005, 'BACKUP_INCOMPLETE');
				}

				const files = await archiveFiles(row.backup, row.destination);

				return {
					filename: `pouchbase-backup-${stamp(row.backup.startedAt)}.tar`,
					size: tarSize(files.map((file) => file.size)),
					body: archiveStream(files, row.backup.startedAt)
				};
			},
			(error) => this.withReason(16012, 'TRANSFER_FAILED', error)
		);
	}

	/**
	 * Starts uploading a downloaded backup to a destination, with the manifest from its archive.
	 * Send the database files with `uploadPart`, then call `finishUpload`. Returns the backup id.
	 */
	startUpload(
		destinationId: string,
		manifest: unknown
	): ResultAsync<string, Failed | DestinationNotFound | InvalidArchive> {
		return this.run(async () => {
			const parsed = parseManifest(manifest) ?? this.fail(16010, 'INVALID_ARCHIVE');
			const destination = await this.requireDestination(destinationId);

			return createUpload(destination, parsed);
		}, this.failed);
	}

	/**
	 * Uploads part `part` (from 1, in order, at least 5 MiB except the last) of a database file of
	 * an upload. Part 1 starts the file over.
	 */
	uploadPart(
		id: string,
		file: DatabaseFile,
		part: number,
		body: Uint8Array<ArrayBuffer>,
		last: boolean
	): ResultAsync<void, BackupNotFound | UploadNotActive | TransferFailed> {
		return this.run(
			async () => {
				const { backup, destination } = await this.requireBackup(id);

				await uploadPart(uploadOf(backup, destination), file, part, body, last);
			},
			(error) => this.withReason(16012, 'TRANSFER_FAILED', error)
		);
	}

	/** Completes an upload once both database files are uploaded: it can be restored then. */
	finishUpload(id: string): ResultAsync<void, BackupNotFound | UploadNotActive | TransferFailed> {
		return this.run(
			async () => {
				const { backup, destination } = await this.requireBackup(id);

				await finishUpload(uploadOf(backup, destination));
			},
			(error) => this.withReason(16012, 'TRANSFER_FAILED', error)
		);
	}

	/**
	 * Replaces the system and app databases (and, with `includeFiles`, the uploaded files) with a
	 * backup; its steps run with `advance()`. Returns the id of the restore.
	 */
	restore(
		backupId: string,
		includeFiles: boolean
	): ResultAsync<string, Failed | BackupNotFound | BackupIncomplete | JobRunning> {
		return this.run(async () => {
			const [backup] = await this.db.select().from(backups).where(eq(backups.id, backupId));

			if (!backup) {
				this.fail(16004, 'BACKUP_NOT_FOUND');
			}

			if (backup.status !== 'completed') {
				this.fail(16005, 'BACKUP_INCOMPLETE');
			}

			await this.requireIdle();

			const id = crypto.randomUUID();
			const state: RestoreState = { step: 'app' };

			await this.db.insert(backupRestores).values({
				id,
				backupId,
				includeFiles: includeFiles && backup.includeFiles,
				state: JSON.stringify(state)
			});

			return id;
		}, this.failed);
	}

	/**
	 * Adds the backups in a destination that aren't in the list yet, e.g. those of an earlier
	 * installation. Returns how many were added; call it again while it returns `DISCOVER_LIMIT`.
	 */
	discover(id: string): ResultAsync<number, DestinationNotFound | DiscoverFailed> {
		return this.run(
			async () => importBackups(await this.requireDestination(id)),
			(error) => this.withReason(16007, 'DISCOVER_FAILED', error)
		);
	}

	/**
	 * Runs steps of the running backups and restores for up to `budget` milliseconds (always at least
	 * one step). Steps that fail are tried again later; a job fails after a few attempts in a row.
	 * Returns whether jobs are still running.
	 */
	advance(budget: number): ResultAsync<{ running: boolean }, Failed> {
		return this.run(() => this.runSteps(budget), this.failed);
	}

	/** Starts the scheduled backups that are due, then runs steps for up to `budget` milliseconds. */
	tick(budget: number): ResultAsync<{ running: boolean }, Failed> {
		return this.run(async () => {
			const now = new Date();
			const due = await this.db
				.select()
				.from(backupSchedules)
				.where(and(eq(backupSchedules.enabled, true), lte(backupSchedules.nextRunAt, now)));

			for (const schedule of due) {
				await startScheduled(this.services, schedule, now);
			}

			await expireUploads();
			await retireDatabases(this.services);

			return this.runSteps(budget);
		}, this.failed);
	}

	/** Whether a backup or restore is running. */
	running(): ResultAsync<boolean, Failed> {
		return this.run(isRunning, this.failed);
	}

	private failed = (error: unknown): Failed => this.error(16000, 'BACKUPS_FAILED', error);

	/** An error whose `data.reason` the caller shows, e.g. what the bucket answered. */
	private withReason<Code extends number, Message extends string>(
		code: Code,
		message: Message,
		error: unknown
	): ServiceError<Code, Message> & WithReason {
		return { ...this.error(code, message, error), data: { reason: describeError(error) } };
	}

	private async runSteps(budget: number) {
		const deadline = Date.now() + budget;
		const single = await this.singleStep();

		do {
			if (!(await this.runOne())) {
				break;
			}
		} while (!single && Date.now() < deadline);

		return { running: await isRunning() };
	}

	/** Runs one step of a running restore, or else of a running backup. Returns whether it did. */
	private async runOne() {
		const now = new Date();
		const restore = await claimJob(backupRestores, now);

		if (restore) {
			await runRestoreStep(this.services, restore);

			return true;
		}

		// No backups while a restore runs (it may be waiting for its lock).
		if (await isRestoring()) {
			return false;
		}

		const backup = await claimJob(backups, now);

		if (backup) {
			await runBackupStep(this.services, backup);

			return true;
		}

		return false;
	}

	/** Free Workers allow few subrequests per invocation: one step each there. */
	private async singleStep() {
		if (typeof navigator === 'undefined' || navigator.userAgent !== 'Cloudflare-Workers') {
			return false;
		}

		const plan = await this.services.cloudflare().plan();

		return plan.isErr() || plan.value === 'free';
	}

	/** Fails with `JOB_RUNNING` while a backup or restore runs. */
	private async requireIdle() {
		if (await isRunning()) {
			this.fail(16003, 'JOB_RUNNING');
		}
	}

	private async requireDestination(id: string) {
		return (await findDestination(id)) ?? this.fail(16001, 'DESTINATION_NOT_FOUND');
	}

	private async requireBackup(id: string) {
		return (await findBackup(id)) ?? this.fail(16004, 'BACKUP_NOT_FOUND');
	}
}
