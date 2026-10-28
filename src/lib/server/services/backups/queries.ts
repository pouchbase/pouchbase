import type { BackupRow, BackupState, Destination, RestoreRow, RestoreState } from './state';

import { eq } from 'drizzle-orm';

import { backupDestinations, backupRestores, backups, db } from '../../db';
import { describeBackupStep, describeRestoreStep, parseState, store } from './state';

/** Lookups and the summaries the Backups page shows; the service turns misses into failures. */

const CONNECTION_TEST_FILE = '.pouchbase-connection-test';

export async function findDestination(id: string): Promise<Destination | null> {
	const [row] = await db.select().from(backupDestinations).where(eq(backupDestinations.id, id));

	return row ?? null;
}

export async function findBackup(
	id: string
): Promise<{ backup: BackupRow; destination: Destination } | null> {
	const [row] = await db
		.select({ backup: backups, destination: backupDestinations })
		.from(backups)
		.innerJoin(backupDestinations, eq(backupDestinations.id, backups.destinationId))
		.where(eq(backups.id, id));

	return row ?? null;
}

export async function isRestoring() {
	const rows = await db
		.select({ id: backupRestores.id })
		.from(backupRestores)
		.where(eq(backupRestores.status, 'running'))
		.limit(1);

	return rows.length > 0;
}

/** Whether a backup or restore is running. */
export async function isRunning() {
	const [running, restoring] = await Promise.all([
		db.select({ id: backups.id }).from(backups).where(eq(backups.status, 'running')).limit(1),
		isRestoring()
	]);

	return running.length > 0 || restoring;
}

/** Writes a test file to the destination and deletes it again; throws what the bucket answered. */
export async function testConnection(destination: Destination) {
	const driver = store(destination);
	const key = `${destination.prefix}/${CONNECTION_TEST_FILE}`;

	await driver.putObject(
		destination.bucket,
		key,
		new TextEncoder().encode('ok').buffer as ArrayBuffer,
		'text/plain'
	);
	await driver.deleteObject(destination.bucket, key);
}

export function backupSummary(backup: BackupRow, destinationName: string) {
	return {
		id: backup.id,
		destinationId: backup.destinationId,
		destinationName,
		scheduled: !!backup.scheduleId,
		status: backup.status,
		step:
			backup.status === 'running'
				? describeBackupStep(parseState<BackupState>(backup.state, { step: 'finish' }))
				: null,
		includeFiles: backup.includeFiles,
		size: backup.size,
		files: backup.files,
		error: backup.error,
		startedAt: backup.startedAt,
		finishedAt: backup.finishedAt
	};
}

export function restoreSummary(restore: RestoreRow, backupStartedAt: Date | null) {
	return {
		id: restore.id,
		backupStartedAt,
		status: restore.status,
		step:
			restore.status === 'running'
				? describeRestoreStep(parseState<RestoreState>(restore.state, { step: 'app' }))
				: null,
		includeFiles: restore.includeFiles,
		files: restore.files,
		error: restore.error,
		startedAt: restore.startedAt,
		finishedAt: restore.finishedAt
	};
}
