import type { ContextError, ErrorOf, ServiceError } from './base.service';
import type { FilesService, StoredFile } from './files.service';
import type { S3Config, StorageDriver } from '../platform';
import type { StorageProvider } from '#lib/schemas/storage.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { ResultAsync } from 'neverthrow';

import { STORAGE_PROVIDERS } from '#lib/schemas/storage.js';

import { reasonOf } from '../errors';
import { createS3Storage, storage } from '../platform';
import { Service } from './base.service';
import { storageKeys } from './files.service';

const NAME_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Written and deleted again when S3 settings are saved, to check that they work. */
const CONNECTION_TEST_KEY = '.pouchbase-connection-test';

/** Files read per migration step, and the objects (files and thumbnails) copied per step at most. */
const FILES_PER_STEP = 10;
const OBJECTS_PER_STEP = 16;

const KEYS = [
	'storage_provider',
	's3_endpoint',
	's3_region',
	's3_bucket',
	's3_access_key_id',
	's3_secret_access_key',
	's3_path_style',
	'storage_migration'
] as const;

/** The storage settings as shown on the Storage page; the secret key never leaves the server. */
export type StorageSettings = {
	provider: StorageProvider;
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	pathStyle: boolean;
	hasSecretAccessKey: boolean;
};

export type UpdateStorageSettingsInput = Omit<StorageSettings, 'hasSecretAccessKey'> & {
	/** Empty keeps the stored secret. */
	secretAccessKey?: string;
};

/** A pending migration as shown on the Storage page; no credentials. */
export type MigrationStatus = {
	source: { provider: StorageProvider; endpoint: string; bucket: string };
	total: number;
	done: number;
};

export type MigrationProgress = { total: number; done: number; finished: boolean };

type StoredSettings = Omit<StorageSettings, 'hasSecretAccessKey'> & { secretAccessKey: string };

/**
 * After switching to other storage, the files stay in the previous one (`source`) until they are
 * copied over; `cursor` is the id of the last file that was copied.
 */
type Migration = { source: StoredSettings; cursor: string | null };

type State = { current: StoredSettings; migration: Migration | null };

/** A driver and the bucket to use with it. */
type Target = { driver: StorageDriver; bucket: string };

/** Where files go, and where files that weren't migrated yet are read from. */
type Locations = { target: Target; source: Target | null };

export type StorageError =
	| ContextError
	| ServiceError<5001, 'SET_SETTING_FAILED'>
	| ServiceError<12000, 'STORAGE_FAILED'>
	| (ServiceError<12004, 'CONNECTION_FAILED'> & { data: { reason: string } })
	| ServiceError<12005, 'MIGRATION_PENDING'>
	| (ServiceError<12006, 'MIGRATION_FAILED'> & { data: { reason: string } });

/** The errors of scanning the files; `FilesService` uses storage too, so they aren't in `StorageError`. */
type ScanError = ErrorOf<ReturnType<FilesService['scan']>>;

// The R2 bucket name never changes once set; cache it per isolate.
let bucketName: string | null = null;

// The storage settings can change, so they are only cached for the request that read them.
const cache = new WeakMap<RequestEvent, Promise<Locations>>();

/** Random bucket name, e.g. `pb-files-k3x9q0w2m7a1`. */
function randomBucketName() {
	const bytes = crypto.getRandomValues(new Uint8Array(12));
	return `pb-files-${Array.from(bytes, (byte) => NAME_ALPHABET[byte % NAME_ALPHABET.length]).join('')}`;
}

/** Whether both settings point at the same bucket (other credentials don't move the files). */
function sameLocation(a: StoredSettings, b: StoredSettings) {
	return (
		a.provider === b.provider &&
		(a.provider === 'r2' || (a.endpoint === b.endpoint && a.bucket === b.bucket))
	);
}

function parseMigration(value: string | null): Migration | null {
	try {
		const parsed = value ? (JSON.parse(value) as Migration) : null;
		return parsed?.source ? parsed : null;
	} catch {
		return null;
	}
}

function s3Config(settings: StoredSettings): S3Config {
	return {
		endpoint: settings.endpoint,
		region: settings.region,
		accessKeyId: settings.accessKeyId,
		secretAccessKey: settings.secretAccessKey,
		pathStyle: settings.pathStyle
	};
}

/**
 * Copies files with their thumbnails until the step's budget is used (always at least one file)
 * and returns how many files were copied. Objects missing in `source` are skipped.
 */
async function copy(files: StoredFile[], source: Target, target: Target) {
	let objects = 0;
	let copied = 0;

	for (const file of files) {
		const keys = storageKeys(file);

		if (copied > 0 && objects + keys.length > OBJECTS_PER_STEP) {
			break;
		}

		await Promise.all(
			keys.map(async (key) => {
				const object = await source.driver.getObject(source.bucket, key);

				if (!object) {
					return;
				}

				await target.driver.putObject(
					target.bucket,
					key,
					await object.arrayBuffer(),
					object.headers.get('content-type') ?? file.mimeType
				);
			})
		);

		objects += keys.length;
		copied++;
	}

	return copied;
}

/**
 * Object storage for uploaded files: R2 on the Cloudflare account by default, or an S3-compatible
 * bucket configured on the Storage page.
 */
export class StorageService extends Service {
	settings(): ResultAsync<StorageSettings, StorageError> {
		return this.run(async () => {
			const { secretAccessKey, ...settings } = (await this.state()).current;

			return { ...settings, hasSecretAccessKey: !!secretAccessKey };
		}, this.failed);
	}

	/**
	 * Saves the settings; S3 settings are only saved when a test object can be written. When the
	 * files move to another bucket, the previous one is remembered until they are migrated.
	 */
	update(input: UpdateStorageSettingsInput): ResultAsync<void, StorageError | ScanError> {
		return this.run(async () => {
			const { current, migration } = await this.state();
			const next: StoredSettings = {
				...input,
				secretAccessKey: input.secretAccessKey || current.secretAccessKey
			};
			const moving = !sameLocation(current, next);

			if (moving && migration) {
				this.fail(12005, 'MIGRATION_PENDING');
			}

			if (next.provider === 's3') {
				await this.testConnection(next);
			}

			const hasFiles = moving && (await this.must(this.services.files().scan(null, 0))).total > 0;

			await this.must(
				this.services.settings().setMany({
					storage_provider: next.provider,
					s3_endpoint: next.endpoint,
					s3_region: next.region,
					s3_bucket: next.bucket,
					s3_access_key_id: next.accessKeyId,
					s3_secret_access_key: next.secretAccessKey,
					s3_path_style: String(next.pathStyle),
					...(hasFiles && {
						storage_migration: JSON.stringify({ source: current, cursor: null })
					})
				})
			);
			cache.delete(this.ctx);
		}, this.failed);
	}

	/** The pending migration, or `null` when all files are in the current storage. */
	migration(): ResultAsync<MigrationStatus | null, StorageError | ScanError> {
		return this.run(async () => {
			const { migration } = await this.state();

			if (!migration) {
				return null;
			}

			const { provider, endpoint, bucket } = migration.source;
			const { total, done } = await this.must(this.services.files().scan(migration.cursor, 0));

			return { source: { provider, endpoint, bucket }, total, done };
		}, this.failed);
	}

	/**
	 * Copies the next few files (with their thumbnails) from the previous storage to the current one.
	 * Call it until `finished`: one step stays well within the subrequest limit of a Worker. The
	 * files are left in the previous storage.
	 */
	migrateNext(): ResultAsync<MigrationProgress, StorageError | ScanError> {
		return this.run(async () => {
			const { migration } = await this.state();

			if (!migration) {
				return { total: 0, done: 0, finished: true };
			}

			const { target, source } = await this.locations();
			const scan = await this.must(this.services.files().scan(migration.cursor, FILES_PER_STEP));
			const copied = await copy(scan.files, source ?? target, target).catch((error: unknown) =>
				this.fail(12006, 'MIGRATION_FAILED', {
					cause: error,
					data: { reason: reasonOf(error) ?? String(error) }
				})
			);
			const finished = copied === scan.files.length && scan.files.length < FILES_PER_STEP;
			const cursor = scan.files[copied - 1]?.id ?? migration.cursor;

			await this.must(
				this.services
					.settings()
					.set(
						'storage_migration',
						finished ? '' : JSON.stringify({ source: migration.source, cursor })
					)
			);
			cache.delete(this.ctx);

			return {
				total: scan.total,
				done: finished ? scan.total : Math.min(scan.total, scan.done + copied),
				finished
			};
		}, this.failed);
	}

	/** Forgets the previous storage: files that weren't migrated can no longer be read. */
	skipMigration(): ResultAsync<void, StorageError> {
		return this.run(async () => {
			await this.must(this.services.settings().set('storage_migration', ''));
			cache.delete(this.ctx);
		}, this.failed);
	}

	/** The R2 bucket for uploads; created on first use, its name is stored in the settings. */
	bucket(): ResultAsync<string, StorageError> {
		return this.run(() => this.r2Bucket(), this.failed);
	}

	put(key: string, body: ArrayBuffer, contentType: string): ResultAsync<void, StorageError> {
		return this.run(async () => {
			const { driver, bucket } = (await this.locations()).target;

			await driver.putObject(bucket, key, body, contentType);
		}, this.failed);
	}

	/**
	 * The object as a streaming response, or `null` when it doesn't exist. During a migration,
	 * files that weren't copied yet are read from the previous storage.
	 */
	get(key: string): ResultAsync<Response | null, StorageError> {
		return this.run(async () => {
			const { target, source } = await this.locations();

			return (
				(await target.driver.getObject(target.bucket, key)) ??
				(source ? await source.driver.getObject(source.bucket, key) : null)
			);
		}, this.failed);
	}

	delete(keys: string[]): ResultAsync<void, StorageError> {
		return this.run(async () => {
			if (!keys.length) {
				return;
			}

			const { target, source } = await this.locations();

			await Promise.all(keys.map((key) => target.driver.deleteObject(target.bucket, key)));

			// Not migrated yet: remove it there too, so it isn't copied later (best effort).
			if (source) {
				await Promise.all(keys.map((key) => source.driver.deleteObject(source.bucket, key))).catch(
					() => undefined
				);
			}
		}, this.failed);
	}

	private failed = (error: unknown) => this.error(12000, 'STORAGE_FAILED', error);

	private locations(): Promise<Locations> {
		const cached = cache.get(this.ctx);

		if (cached) {
			return cached;
		}

		const locations = (async () => {
			const { current, migration } = await this.state();
			const target = await this.locate(current);

			return { target, source: migration ? await this.locate(migration.source) : null };
		})();

		cache.set(this.ctx, locations);

		return locations;
	}

	private async locate(settings: StoredSettings): Promise<Target> {
		return settings.provider === 's3'
			? { driver: createS3Storage(s3Config(settings)), bucket: settings.bucket }
			: { driver: storage, bucket: await this.r2Bucket() };
	}

	private async r2Bucket() {
		if (bucketName) {
			return bucketName;
		}

		const settings = this.services.settings();
		let name = await this.must(settings.get('files_bucket_name'));

		if (!name) {
			name = randomBucketName();

			if (!(await storage.bucketExists(name))) {
				await storage.createBucket(name);
			}

			await this.must(settings.set('files_bucket_name', name));
		}

		bucketName = name;

		return name;
	}

	private async testConnection(settings: StoredSettings) {
		const driver = createS3Storage(s3Config(settings));

		try {
			await driver.putObject(
				settings.bucket,
				CONNECTION_TEST_KEY,
				new TextEncoder().encode('ok').buffer as ArrayBuffer,
				'text/plain'
			);
			await driver.deleteObject(settings.bucket, CONNECTION_TEST_KEY);
		} catch (error) {
			this.fail(12004, 'CONNECTION_FAILED', {
				cause: error,
				data: { reason: reasonOf(error) ?? String(error) }
			});
		}
	}

	private async state(): Promise<State> {
		const values = await this.must(this.services.settings().getMany(KEYS));
		const provider = values.storage_provider as StorageProvider;

		return {
			current: {
				provider: STORAGE_PROVIDERS.includes(provider) ? provider : 'r2',
				endpoint: values.s3_endpoint ?? '',
				region: values.s3_region ?? '',
				bucket: values.s3_bucket ?? '',
				accessKeyId: values.s3_access_key_id ?? '',
				secretAccessKey: values.s3_secret_access_key ?? '',
				pathStyle: values.s3_path_style === 'true'
			},
			migration: parseMigration(values.storage_migration)
		};
	}
}
