import type { ContextError, ServiceError } from './base.service';
import type { Release, UpdateStatus, WorkerManifest } from '#lib/updates.js';
import type { ResultAsync } from 'neverthrow';

import { compareVersions, WORKER_FILES_ASSET } from '#lib/updates.js';

import { version as CURRENT_VERSION } from '../../../../package.json';
import { reasonOf } from '../errors';
import { selfUpdate } from '../platform';
import { latestRelease, releaseFile, workerManifest } from '../releases';
import { nodeRuntime, runtime } from '../runtime';
import { Failure, Service } from './base.service';

/** How long the latest release from GitHub is reused before it is looked up again. */
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

interface UpdateCheck {
	checkedAt: string | null;
	latest: Release | null;
}

export type UpdatesError =
	| ContextError
	| ServiceError<5001, 'SET_SETTING_FAILED'>
	| ServiceError<21000, 'UPDATES_FAILED'>
	| ServiceError<21001, 'UPDATE_NOT_SUPPORTED'>
	| ServiceError<21002, 'NO_UPDATE_AVAILABLE'>
	| (ServiceError<21003, 'PREPARE_UPDATE_FAILED'> & { data: { reason: string } })
	| ServiceError<21006, 'INVALID_MODULES'>
	| (ServiceError<21007, 'DEPLOY_UPDATE_FAILED'> & { data: { reason: string } });

function parseCheck(value: string | null): UpdateCheck | null {
	if (!value) {
		return null;
	}

	try {
		return JSON.parse(value) as UpdateCheck;
	} catch {
		return null;
	}
}

async function sha256(blob: Blob) {
	const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());

	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Whether every module matches its SHA-256 in the manifest. */
async function modulesMatch(manifest: WorkerManifest, modules: Map<string, Blob>) {
	for (const module of manifest.modules) {
		const contents = modules.get(module.name);

		if (!contents || (await sha256(contents)) !== module.sha256) {
			return false;
		}
	}

	return true;
}

/**
 * Updates of Pouchbase itself. The latest release is looked up on GitHub at most every six hours
 * (`update_check` in the settings). How an instance updates depends on where it runs (see
 * `#lib/updates.ts`): a Worker deploys the release to itself, with the update dialog moving the
 * files (`prepareWorker`, `workerFiles`, `uploadWorkerAssets`, `deployWorker`), so no single request
 * does much work; the single binary replaces itself and restarts (`updateBinary`).
 */
export class UpdatesService extends Service {
	/** The running version, the latest release and whether this instance can install it. */
	status({ refresh = false } = {}): ResultAsync<UpdateStatus, UpdatesError> {
		return this.run(async () => {
			const check = await this.check(refresh);

			return {
				current: CURRENT_VERSION,
				runtime: runtime(),
				latest: check.latest,
				available: !!check.latest && compareVersions(check.latest.version, CURRENT_VERSION) > 0,
				checkedAt: check.checkedAt
			};
		}, this.failed);
	}

	/**
	 * Starts updating the Worker to the latest release: registers its assets with Cloudflare. The
	 * dialog then uploads the hashes in `buckets` (`uploadWorkerAssets`), one request per bucket, and
	 * deploys with the completion token (`deployWorker`). When `buckets` is empty, `jwt` is the
	 * completion token already. The latest release is looked up again first, so `deployWorker`
	 * installs the same version from the refreshed check.
	 */
	prepareWorker(): ResultAsync<
		{ version: string; jwt: string; buckets: string[][] },
		UpdatesError
	> {
		return this.run(async () => {
			this.requireRuntime('workers');

			const version = await this.target(true);

			try {
				const manifest = await workerManifest(version);
				const session = await selfUpdate.startAssetUpload(manifest);

				return { version, ...session };
			} catch (error) {
				this.fail(21003, 'PREPARE_UPDATE_FAILED', {
					cause: error,
					data: { reason: reasonOf(error) ?? String(error) }
				});
			}
		}, this.failed);
	}

	/**
	 * The contents of the modules and assets of a release (`pouchbase-worker-files.json.gz`), as
	 * GitHub serves it, so the dialog can read them without depending on GitHub's CORS headers.
	 */
	workerFiles(version: string): ResultAsync<Response, UpdatesError> {
		return this.run(() => releaseFile(version, WORKER_FILES_ASSET), this.failed);
	}

	/**
	 * Uploads one bucket of assets (a multipart body with the base64 contents per hash) with the
	 * upload token of `prepareWorker`. Returns the completion token after the last bucket.
	 */
	uploadWorkerAssets(
		jwt: string,
		body: ArrayBuffer,
		contentType: string
	): ResultAsync<string | null, UpdatesError> {
		return this.run(async () => {
			this.requireRuntime('workers');

			return selfUpdate.uploadAssets(jwt, body, contentType);
		}, this.failed);
	}

	/**
	 * Deploys the latest release to the Worker with the uploaded assets. The modules come from the
	 * dialog, which read them from the release; each must match its SHA-256 in the manifest.
	 */
	deployWorker(assetsJwt: string, modules: Map<string, Blob>): ResultAsync<string, UpdatesError> {
		return this.run(async () => {
			this.requireRuntime('workers');

			const version = await this.target(false);
			const manifest = await workerManifest(version).catch((error: unknown) =>
				this.deployFailed(error)
			);

			if (!(await modulesMatch(manifest, modules))) {
				this.fail(21006, 'INVALID_MODULES');
			}

			await selfUpdate
				.deployWorker(manifest, assetsJwt, modules)
				.catch((error: unknown) => this.deployFailed(error));

			return manifest.version;
		}, this.failed);
	}

	/**
	 * Replaces the single binary with the latest release and restarts it right after the response.
	 * Returns the installed version.
	 */
	updateBinary(): ResultAsync<string, UpdatesError> {
		return this.run(async () => {
			this.requireRuntime('binary');

			const node = nodeRuntime();

			if (!node?.update || !node.restart) {
				this.fail(21001, 'UPDATE_NOT_SUPPORTED');
			}

			const installed = await node.update();

			if (!installed) {
				this.fail(21002, 'NO_UPDATE_AVAILABLE');
			}

			// After the response is out; the dialog waits for the new version to answer.
			setTimeout(node.restart, 1000);

			return installed;
		}, this.failed);
	}

	private failed = (error: unknown) => this.error(21000, 'UPDATES_FAILED', error);

	/** The last answer of GitHub, looked up again when it is older than six hours or `refresh`. */
	private async check(refresh: boolean): Promise<UpdateCheck> {
		const settings = this.services.settings();
		const cached = parseCheck(await this.must(settings.get('update_check')));
		const fresh =
			cached?.checkedAt && Date.now() - new Date(cached.checkedAt).getTime() < CHECK_INTERVAL;

		if (fresh && !refresh) {
			return cached;
		}

		try {
			const check = { checkedAt: new Date().toISOString(), latest: await latestRelease() };

			await this.must(settings.set('update_check', JSON.stringify(check)));

			return check;
		} catch (error) {
			if (error instanceof Failure) {
				throw error;
			}

			// GitHub being unreachable isn't an error here: the previous answer is kept.
			console.error('[pouchbase] Could not look up the latest release', error);

			return cached ?? { checkedAt: null, latest: null };
		}
	}

	/**
	 * The version to install: the latest release, when it is newer than this one. With `refresh`,
	 * GitHub is asked again instead of using the answer of the last six hours, which may name a
	 * release that has been superseded since.
	 */
	private async target(refresh: boolean) {
		const { latest } = await this.check(refresh);

		if (!latest || compareVersions(latest.version, CURRENT_VERSION) <= 0) {
			this.fail(21002, 'NO_UPDATE_AVAILABLE');
		}

		return latest.version;
	}

	private requireRuntime(kind: UpdateStatus['runtime']) {
		if (runtime() !== kind) {
			this.fail(21001, 'UPDATE_NOT_SUPPORTED');
		}
	}

	private deployFailed(error: unknown): never {
		this.fail(21007, 'DEPLOY_UPDATE_FAILED', {
			cause: error,
			data: { reason: reasonOf(error) ?? String(error) }
		});
	}
}
