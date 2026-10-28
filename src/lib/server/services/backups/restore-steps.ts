import type { BackupRow, Destination, RestoreRow, RestoreState, SpareDatabase } from './state';
import type { ObjectStore } from '../../platform';
import type { Services } from '../services';

import { eq, sql } from 'drizzle-orm';

import { encode, identifier, insertStatement, literal, splitStatements } from '#lib/backups/sql.js';

import { backupDestinations, backupRestores, backups, db, settings } from '../../db';
import {
	batchDatabase,
	getDatabaseId,
	importDatabase,
	pollDatabaseImport,
	queryDatabase,
	queryObjects
} from '../../db/query';
import { runJobStep, StepError, stepResult } from '../../jobs';
import { forgetFilesCollection, storageKeys } from '../files.service';
import { MAX_ATTEMPTS, OBJECTS_PER_STEP, parseState, restoreState, sleep, store } from './state';

/**
 * The steps of a restore: create a spare database, load the app dump into it (D1's import for
 * small dumps, batches of statements for large ones), replace the system database and switch to
 * the spare one in the same import, then copy the files back. Every function throws; the job
 * runner records what went wrong.
 */

/** How long the restore of the system database is awaited within its step. */
const SYSTEM_IMPORT_TIMEOUT = 60 * 1000;

/**
 * App dumps up to this size are restored with D1's import (fast, but the file must be in memory to
 * compute its checksum). Larger ones are loaded in chunks of `LOAD_CHUNK` bytes, read with range
 * requests and run as batches of statements, so memory and CPU per step stay small.
 */
const IMPORT_LIMIT = 32 * 1024 * 1024;
const LOAD_CHUNK = 2 * 1024 * 1024;
const BATCH_STATEMENTS = 500;
const BATCH_BYTES = 512 * 1024;

/**
 * The app database a restore replaced is deleted this long after the switch, once every isolate
 * has picked up the new one (they cache it for a minute, see `DatabaseService.getApp`).
 */
const RETIRE_AFTER = 10 * 60 * 1000;

/**
 * Tables of the system database that a restore keeps as they are now: the backups themselves (a
 * restore must not forget the backups made after the one it restores, nor itself) and the sessions
 * (so admins stay logged in). Order matters: referenced tables first.
 */
const PRESERVED_TABLES = [
	'backup_destinations',
	'backup_schedules',
	'backups',
	'backup_restores',
	'backup_files',
	'sessions'
] as const;

/**
 * Settings a restore sets itself: the app database (the spare one it loaded) and the bucket of this
 * installation.
 */
const PRESERVED_SETTINGS = ['app_database_id', 'app_database_name', 'files_bucket_name'];

type Outcome = { state?: RestoreState; files?: number; done?: boolean };

/** Runs the step a restore is at and saves the result on its row. */
export async function runRestoreStep(services: Services, restore: RestoreRow) {
	const state = restoreState(restore);

	await runJobStep(
		restore,
		{
			label: `restore ${restore.id} (${state.step})`,
			maxAttempts: MAX_ATTEMPTS,
			onFailed: async () => {
				if ('database' in state) {
					await discardSpare(services, state.database);
				}
			}
		},
		async () => {
			const [row] = restore.backupId
				? await db
						.select({ backup: backups, destination: backupDestinations })
						.from(backups)
						.innerJoin(backupDestinations, eq(backupDestinations.id, backups.destinationId))
						.where(eq(backups.id, restore.backupId))
				: [];

			if (!row) {
				throw new StepError('The backup was deleted');
			}

			const result = await restoreStep(services, restore, row.backup, row.destination, state);

			// The system step saved its own progress, inside the restored database.
			if (!result) {
				return null;
			}

			return {
				values: {
					state: JSON.stringify({ ...(result.state ?? state), retire: state.retire }),
					files: restore.files + (result.files ?? 0)
				},
				done: result.done
			};
		},
		(values) => db.update(backupRestores).set(values).where(eq(backupRestores.id, restore.id))
	);
}

async function restoreStep(
	services: Services,
	restore: RestoreRow,
	backup: BackupRow,
	destination: Destination,
	state: RestoreState
): Promise<Outcome | null> {
	const source = store(destination);

	if (state.step === 'app') {
		// Both dumps must be there before anything changes.
		const [system, app] = await Promise.all(
			['system.sql', 'app.sql'].map((file) =>
				source.getRange(destination.bucket, `${backup.key}/${file}`, 0, 1)
			)
		);

		if (!system || !app) {
			throw new StepError(`The backup in ${backup.key} is incomplete`);
		}

		const database = await stepResult(services.database().createSpare());

		return {
			state:
				app.size <= IMPORT_LIMIT
					? { step: 'import', database, bookmark: null }
					: { step: 'load', database, offset: 0, size: app.size }
		};
	}

	if (state.step === 'import') {
		const progress = state.bookmark
			? await pollDatabaseImport(state.database.id, state.bookmark)
			: await importDatabase(
					state.database.id,
					await download(source, destination, `${backup.key}/app.sql`)
				);

		return {
			state: progress.done
				? { step: 'system', database: state.database }
				: { ...state, bookmark: progress.bookmark }
		};
	}

	if (state.step === 'load') {
		return { state: await loadChunk(restore, backup, destination, source, state) };
	}

	if (state.step === 'system') {
		await restoreSystem(services, restore, backup, destination, source, state.database);

		return null;
	}

	if (state.step === 'files') {
		return restoreFiles(services, destination, source, state.cursor);
	}

	return { done: true };
}

/**
 * Runs the statements in the next chunk of a large app dump on the spare database, in batches.
 * The offset is saved after every batch, so a retry never runs a statement twice.
 */
async function loadChunk(
	restore: RestoreRow,
	backup: BackupRow,
	destination: Destination,
	source: ObjectStore,
	state: Extract<RestoreState, { step: 'load' }>
): Promise<RestoreState> {
	const chunk = await source.getRange(
		destination.bucket,
		`${backup.key}/app.sql`,
		state.offset,
		state.offset + LOAD_CHUNK
	);

	if (!chunk) {
		throw new StepError(`${backup.key}/app.sql is missing in the destination`);
	}

	const final = state.offset + chunk.bytes.byteLength >= chunk.size;
	const { statements } = splitStatements(chunk.bytes, final);

	if (!statements.length && !final) {
		throw new StepError('app.sql has a statement larger than 2 MB, which D1 can’t run');
	}

	let batch: typeof statements = [];
	let bytes = 0;

	const flush = async () => {
		if (!batch.length) {
			return;
		}

		await batchDatabase(
			state.database.id,
			batch.map((statement) => ({ sql: statement.sql }))
		);

		const offset = state.offset + batch[batch.length - 1].end;

		batch = [];
		bytes = 0;

		await db
			.update(backupRestores)
			.set({ state: JSON.stringify({ ...state, offset, size: chunk.size }) })
			.where(eq(backupRestores.id, restore.id));
	};

	for (const statement of statements) {
		// D1 runs these itself; foreign keys are checked per batch otherwise.
		if (/^PRAGMA\s+defer_foreign_keys/i.test(statement.sql)) {
			continue;
		}

		if (batch.length >= BATCH_STATEMENTS || bytes + statement.sql.length > BATCH_BYTES) {
			await flush();
		}

		batch.push(statement);
		bytes += statement.sql.length;
	}

	await flush();

	if (final) {
		return { step: 'system', database: state.database };
	}

	return { ...state, offset: state.offset + (statements.at(-1)?.end ?? 0), size: chunk.size };
}

/** Deletes the spare database of a failed restore, unless the app already switched to it. */
async function discardSpare(services: Services, database: SpareDatabase) {
	const current = await services.database().getApp();

	if (current.isOk() && current.value && current.value.id !== database.id) {
		await services.database().delete(database.id);
	}
}

/**
 * Replaces the system database in one import: the dump, then the preserved tables and settings
 * as they are now (see `PRESERVED_TABLES`), pointing at the spare database as the app database.
 * The restore's own row is written in its next state, so the restored database continues where
 * this step ends.
 */
async function restoreSystem(
	services: Services,
	restore: RestoreRow,
	backup: BackupRow,
	destination: Destination,
	source: ObjectStore,
	database: SpareDatabase
) {
	const systemId = await getDatabaseId();

	if (!systemId) {
		throw new StepError('The system database is missing');
	}

	const dump = await download(source, destination, `${backup.key}/system.sql`);
	const replaced = await stepResult(services.database().requireApp());
	const retire = { id: replaced.id, at: Date.now() };
	const next: RestoreState = restore.includeFiles
		? { step: 'files', cursor: null, retire }
		: { step: 'done', retire };
	const done = !restore.includeFiles;
	const statements = [...PRESERVED_TABLES]
		.reverse()
		.map((table) => `DELETE FROM ${identifier(table)};`);

	for (const table of PRESERVED_TABLES) {
		for (const row of await queryObjects(systemId, `SELECT * FROM ${identifier(table)}`)) {
			if (table === 'backup_restores' && row.id === restore.id) {
				Object.assign(row, {
					state: JSON.stringify(next),
					attempts: 0,
					error: null,
					locked_until: null,
					...(done && { status: 'completed', finished_at: Date.now() })
				});
			}

			// Sessions of admins that don't exist in the backup are dropped.
			statements.push(
				table === 'sessions'
					? insertStatement(
							table,
							row,
							`WHERE EXISTS (SELECT 1 FROM "users" WHERE "id" = ${literal(row.user_id)})`
						)
					: insertStatement(table, row)
			);
		}
	}

	const [bucket] = await db.select().from(settings).where(eq(settings.key, 'files_bucket_name'));

	statements.push(
		`DELETE FROM "settings" WHERE "key" IN (${PRESERVED_SETTINGS.map(literal).join(', ')});`,
		insertStatement('settings', { key: 'app_database_id', value: database.id }),
		insertStatement('settings', { key: 'app_database_name', value: database.name }),
		...(bucket ? [insertStatement('settings', bucket)] : [])
	);

	let progress = await importDatabase(
		systemId,
		encode(
			'PRAGMA defer_foreign_keys = true;\n',
			(await dropStatements(systemId)).join('\n'),
			'\n',
			dump,
			'\n',
			statements.join('\n'),
			'\n'
		)
	);
	const deadline = Date.now() + SYSTEM_IMPORT_TIMEOUT;

	while (!progress.done) {
		if (Date.now() > deadline) {
			throw new StepError('Restoring the system database takes longer than expected');
		}

		await sleep(1000);
		progress = await pollDatabaseImport(systemId, progress.bookmark);
	}

	// The restored database may be older than this version, and the files collection may differ.
	// `remigrate` also makes this isolate use the new app database right away.
	forgetFilesCollection();
	await stepResult(services.database().remigrate());
}

/** Copies the files of the restored app database back from the destination. */
async function restoreFiles(
	services: Services,
	destination: Destination,
	source: ObjectStore,
	cursor: string | null
): Promise<Outcome> {
	const scan = await stepResult(services.files().scan(cursor, OBJECTS_PER_STEP));
	const storage = services.storage();
	let objects = 0;
	let handled = 0;
	let files = 0;

	for (const file of scan.files) {
		const keys = storageKeys(file);

		if (handled > 0 && objects + keys.length > OBJECTS_PER_STEP) {
			break;
		}

		let restored = false;

		for (const key of keys) {
			const object = await source.getObject(
				destination.bucket,
				`${destination.prefix}/files/${key}`
			);

			// Not in the backup (e.g. a thumbnail made after the last backup); it's made again when needed.
			if (!object) {
				continue;
			}

			await stepResult(
				storage.put(
					key,
					await object.arrayBuffer(),
					object.headers.get('content-type') ?? file.mimeType
				)
			);
			restored = true;
		}

		objects += keys.length;
		handled++;

		if (restored) {
			files++;
		}
	}

	const finished = handled === scan.files.length && scan.files.length < OBJECTS_PER_STEP;

	return {
		state: { step: 'files', cursor: scan.files[handled - 1]?.id ?? cursor },
		files,
		done: finished
	};
}

/** Deletes the app databases that restores replaced, once no isolate uses them anymore. */
export async function retireDatabases(services: Services) {
	const rows = await db
		.select({ id: backupRestores.id, state: backupRestores.state })
		.from(backupRestores)
		.where(sql`${backupRestores.state} LIKE '%"retire"%'`);

	for (const row of rows) {
		const { retire, ...state } = parseState<RestoreState>(row.state, { step: 'done' });

		if (!retire || Date.now() - retire.at < RETIRE_AFTER) {
			continue;
		}

		// Never the database the app uses, e.g. after restoring an older backup.
		const current = await services.database().getApp();

		if (current.isOk() && current.value?.id !== retire.id) {
			const deleted = await services.database().delete(retire.id);

			if (deleted.isErr()) {
				console.warn(`[backups] could not delete the replaced app database ${retire.id}`);
				continue;
			}
		}

		await db
			.update(backupRestores)
			.set({ state: JSON.stringify(state) })
			.where(eq(backupRestores.id, row.id));
	}
}

async function download(source: ObjectStore, destination: Destination, key: string) {
	const object = await source.getObject(destination.bucket, key);

	if (!object) {
		throw new StepError(`${key} is missing in the destination`);
	}

	return new Uint8Array(await object.arrayBuffer());
}

/** Dropping everything first lets the dump create the tables as they were. */
async function dropStatements(databaseId: string) {
	const rows = await queryDatabase(
		databaseId,
		`SELECT "type", "name" FROM sqlite_master WHERE "type" IN ('table', 'view') AND "name" NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND "name" NOT LIKE '\\_cf\\_%' ESCAPE '\\'`
	);

	return rows.map(
		([type, name]) =>
			`DROP ${type === 'view' ? 'VIEW' : 'TABLE'} IF EXISTS ${identifier(String(name))};`
	);
}
