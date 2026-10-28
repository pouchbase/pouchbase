import type { ServiceError } from './base.service';

import { okAsync, ResultAsync } from 'neverthrow';

import {
	attachDatabases,
	createDatabase,
	deleteDatabase,
	ensureDatabase,
	getDatabaseId
} from '../db/query';
import { migrate } from '../db/migrate';
import { Service } from './base.service';

export type AppDatabase = {
	id: string;
	name: string;
};

// Migrations only need to run once per isolate; concurrent first requests share the same run.
let migration: Promise<void> | undefined;

// Cached per isolate for a minute: a restore replaces the app database with a new one, and other
// isolates must switch to it before the old one is deleted (see `BackupsService`).
let appDatabase: AppDatabase | undefined;
let appDatabaseCachedAt = 0;

const APP_DATABASE_TTL = 60 * 1000;

const NAME_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Random name for the app database, e.g. `pb-k3x9q0w2m7a1`. */
function randomDatabaseName() {
	const bytes = crypto.getRandomValues(new Uint8Array(12));
	return `pb-${Array.from(bytes, (byte) => NAME_ALPHABET[byte % NAME_ALPHABET.length]).join('')}`;
}

export class DatabaseService extends Service {
	/** Whether the system database exists (it is created during installation). */
	exists(): ResultAsync<boolean, ServiceError<1000, 'DATABASE_LOOKUP_FAILED'>> {
		return this.run(
			async () => (await getDatabaseId()) !== null,
			(error) => this.error(1000, 'DATABASE_LOOKUP_FAILED', error)
		);
	}

	/** Creates the system database if needed, then runs pending migrations. */
	prepare(): ResultAsync<
		void,
		ServiceError<1001, 'DATABASE_CREATE_FAILED'> | ServiceError<1002, 'DATABASE_MIGRATION_FAILED'>
	> {
		return this.run(
			async () => {
				await ensureDatabase();
				await this.must(this.migrate());
			},
			(error) => this.error(1001, 'DATABASE_CREATE_FAILED', error)
		);
	}

	/** Applies pending migrations to the system database (once per isolate). */
	migrate(): ResultAsync<void, ServiceError<1002, 'DATABASE_MIGRATION_FAILED'>> {
		migration ??= migrate().catch((error: unknown) => {
			// Let the next request try again.
			migration = undefined;
			throw error;
		});

		const pending = migration;

		return this.run(
			() => pending,
			(error) => this.error(1002, 'DATABASE_MIGRATION_FAILED', error)
		);
	}

	/**
	 * Runs the migrations again in this isolate, after a restore replaced the system database with
	 * one that may be older.
	 */
	remigrate(): ResultAsync<void, ServiceError<1002, 'DATABASE_MIGRATION_FAILED'>> {
		migration = undefined;
		appDatabase = undefined;

		return this.migrate();
	}

	/**
	 * Lets the platform connect the system and app databases more directly; on Cloudflare the
	 * Worker adds D1 bindings for them to itself (see `platform/cloudflare/bindings.ts`). Queries
	 * work without it, so callers run it in the background.
	 */
	attach(): ResultAsync<
		void,
		| ServiceError<1000, 'DATABASE_LOOKUP_FAILED'>
		| ServiceError<1005, 'DATABASE_ATTACH_FAILED'>
		| ServiceError<5000, 'GET_SETTING_FAILED'>
	> {
		return this.run(
			async () => {
				const [systemId, appDatabase] = await Promise.all([
					getDatabaseId(),
					this.must(this.getApp())
				]);

				await attachDatabases([systemId, appDatabase?.id].filter((id): id is string => !!id));
			},
			(error) => this.error(1005, 'DATABASE_ATTACH_FAILED', error)
		);
	}

	/** The app database, or `null` when it hasn't been created yet. */
	getApp(): ResultAsync<AppDatabase | null, ServiceError<5000, 'GET_SETTING_FAILED'>> {
		if (appDatabase && Date.now() - appDatabaseCachedAt < APP_DATABASE_TTL) {
			return okAsync(appDatabase);
		}

		const settings = this.services.settings();

		return ResultAsync.combine([
			settings.get('app_database_id'),
			settings.get('app_database_name')
		]).map(([id, name]) => {
			appDatabase = id && name ? { id, name } : undefined;
			appDatabaseCachedAt = Date.now();
			return appDatabase ?? null;
		});
	}

	/** The app database; an error when it hasn't been created yet. */
	requireApp(): ResultAsync<
		AppDatabase,
		ServiceError<1004, 'APP_DATABASE_MISSING'> | ServiceError<5000, 'GET_SETTING_FAILED'>
	> {
		return this.run(
			async () => (await this.must(this.getApp())) ?? this.fail(1004, 'APP_DATABASE_MISSING'),
			(error) => this.error(1004, 'APP_DATABASE_MISSING', error)
		);
	}

	/**
	 * A new, empty database with a random name that isn't used yet; a restore loads a backup into it
	 * before it becomes the app database.
	 */
	createSpare(): ResultAsync<AppDatabase, ServiceError<1003, 'APP_DATABASE_CREATE_FAILED'>> {
		return this.run(
			async () => {
				const database = await createDatabase(randomDatabaseName());

				return { id: database.id, name: database.name };
			},
			(error) => this.error(1003, 'APP_DATABASE_CREATE_FAILED', error)
		);
	}

	/** Deletes a database that is no longer used, e.g. the app database a restore replaced. */
	delete(id: string): ResultAsync<void, ServiceError<1006, 'DATABASE_DELETE_FAILED'>> {
		return this.run(
			() => deleteDatabase(id),
			(error) => this.error(1006, 'DATABASE_DELETE_FAILED', error)
		);
	}

	/**
	 * Creates the app database with a random name and stores it in the settings.
	 * Returns the existing one if it was already created, so it is safe to retry.
	 */
	createApp(): ResultAsync<
		AppDatabase,
		| ServiceError<1003, 'APP_DATABASE_CREATE_FAILED'>
		| ServiceError<5000, 'GET_SETTING_FAILED'>
		| ServiceError<5001, 'SET_SETTING_FAILED'>
	> {
		return this.run(
			async () => {
				const existing = await this.must(this.getApp());

				if (existing) {
					return existing;
				}

				const created = await createDatabase(randomDatabaseName());
				const database: AppDatabase = { id: created.id, name: created.name };
				const settings = this.services.settings();

				await this.must(settings.set('app_database_id', database.id));
				await this.must(settings.set('app_database_name', database.name));

				return database;
			},
			(error) => this.error(1003, 'APP_DATABASE_CREATE_FAILED', error)
		);
	}
}
