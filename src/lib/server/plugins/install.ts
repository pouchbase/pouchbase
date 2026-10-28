import type { PluginManifest, PluginVersion } from '@pouchbasejs/plugin-sdk';
import type { ApiKeysService } from '../services/api-keys.service';
import type { Services } from '../services/services';
import type { PluginRuntimes } from './runtimes';
import type { InstalledRow, PluginRow } from './sources';
import type { CompiledUi } from './compile';
import type { DescribeResult, PluginCallContext, PluginRuntime, ProviderConfig } from './protocol';

import {
	DEFAULT_REGISTRY_URL,
	RegistryError,
	SERVER_FILE,
	SUPPORTED_API_VERSIONS,
	checkCompatibility,
	createRegistryClient,
	parseBundle,
	splitBundle
} from '@pouchbasejs/plugin-sdk';
import { eq } from 'drizzle-orm';

import { dev } from '$app/env';
import { POUCHBASE_INSTANCE, POUCHBASE_REGISTRY_URL } from '$app/env/private';

import { version as POUCHBASE_VERSION } from '../../../../package.json';
import { generateToken } from '../crypto';
import {
	apiKeys as apiKeyRows,
	db,
	pluginAuthProviders,
	pluginBundleParts,
	pluginModules,
	pluginSettings,
	plugins
} from '../db';
import { describeError } from '../errors';
import { functions as driver } from '../platform';
import { background } from '../platform/runtime';
import { PluginCallError } from './dispatch';
import { fail } from './errors';
import { installedInProcess } from './in-process';
import { chunks } from '../db/query';
import { moduleRows, MODULE_ROWS_PER_INSERT } from './modules';
import { describePlugin } from './protocol';
import { providerConfigs, providerRow } from './providers';
import { INSTALLED_COLUMNS } from './sources';
import { ENTRY_MODULE, pluginScriptName, workerModules, WorkerRuntime } from './worker';

/**
 * Installing a plugin from a registry: getting and checking the bundle, deploying its server code
 * to a Worker of its own and asking that what it implements. The steps throw the plugin errors
 * (`errors.ts`); `PluginsService.install` puts them together.
 */

/**
 * In development (`vite dev`), installed plugins run their server code inside Pouchbase, like
 * the built-in plugins (`in-process.ts`), instead of in a Worker of their own: a Worker on
 * Cloudflare can't reach a Pouchbase on `localhost`, so its `ctx.pouch` would always fail, and
 * skipping the deploy makes installing much faster. The code runs without the Worker's sandbox,
 * so only install plugins you trust while developing; builds always deploy Workers.
 */
export const RUN_INSTALLED_IN_PROCESS = dev;

/** How often `describe` is tried right after a deploy, while workers.dev picks up the Worker. */
const DESCRIBE_ATTEMPTS = 5;

const HOST = { version: POUCHBASE_VERSION, apiVersions: SUPPORTED_API_VERSIONS };

type Registry = ReturnType<typeof createRegistryClient>;

export function registryUrl() {
	return POUCHBASE_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
}

export function registryClient(): Registry {
	return createRegistryClient({ url: registryUrl() });
}

/** Fails with `REGISTRY_REQUEST_FAILED` for an error of the registry client. */
export function registryFailure(error: unknown): never {
	return fail(
		{
			code: 19000,
			message: 'REGISTRY_REQUEST_FAILED',
			data: {
				status: error instanceof RegistryError ? error.status : 0,
				reason: error instanceof Error ? error.message : String(error)
			}
		},
		error
	);
}

/**
 * Why this Pouchbase can't install a plugin, or `null`. In development the app runs unreleased
 * code, which plugins written for the coming release target with `engines.pouchbase`, so only the
 * plugin API version is checked there.
 */
function incompatibility(manifest: Pick<PluginManifest, 'apiVersion' | 'engines'>) {
	return checkCompatibility(
		dev ? { apiVersion: manifest.apiVersion, engines: {} } : manifest,
		HOST
	);
}

type FetchedBundle = {
	version: PluginVersion;
	bytes: Uint8Array;
	manifest: PluginManifest;
	/** Bundle path → contents. */
	files: Record<string, string>;
	/** The plugin's `server.js`; `null` without server code. */
	server: string | null;
};

/**
 * Downloads and checks the bundle of `id` at `requested` (`latest`: the newest version this
 * Pouchbase can run). Fails with `PLUGIN_NOT_FOUND`, `PLUGIN_INCOMPATIBLE` or `INVALID_BUNDLE`.
 */
export async function fetchBundle(
	registry: Registry,
	id: string,
	requested: string
): Promise<FetchedBundle> {
	let version: PluginVersion | null;

	try {
		version = await registry.getVersion(id, requested, SUPPORTED_API_VERSIONS);
	} catch (error) {
		return registryFailure(error);
	}

	if (!version) {
		fail({ code: 19002, message: 'PLUGIN_NOT_FOUND' });
	}

	const listed = incompatibility({
		apiVersion: version.apiVersion,
		engines: { pouchbase: version.pouchbase ?? undefined }
	});

	if (listed) {
		fail({ code: 19003, message: 'PLUGIN_INCOMPATIBLE', data: { reason: listed } });
	}

	let bytes: Uint8Array;

	try {
		bytes = await registry.download(version);
	} catch (error) {
		return registryFailure(error);
	}

	const result = parseBundle(bytes);

	if (!result.success) {
		fail({ code: 19004, message: 'INVALID_BUNDLE', data: { issues: result.issues } });
	}

	const { manifest, files } = result.bundle;

	// The registry must serve what it listed; anything else is a broken or hostile registry.
	if (manifest.id !== id || manifest.version !== version.version) {
		fail({
			code: 19004,
			message: 'INVALID_BUNDLE',
			data: {
				issues: [
					{
						path: 'manifest',
						message: `Expected ${id}@${version.version}, got ${manifest.id}@${manifest.version}`
					}
				]
			}
		});
	}

	// Checked again on the manifest itself, which may differ from what the registry listed.
	const actual = incompatibility(manifest);

	if (actual) {
		fail({ code: 19003, message: 'PLUGIN_INCOMPATIBLE', data: { reason: actual } });
	}

	return { version, bytes, manifest, files, server: files[SERVER_FILE] ?? null };
}

function deployFailure(error: unknown): never {
	return fail(
		{ code: 19007, message: 'PLUGIN_DEPLOY_FAILED', data: { reason: describeError(error) } },
		error
	);
}

type DeployedWorker = { url: string; secret: string };

/**
 * Deploys `server` to the plugin's Worker with a new API key, and keeps the secret of an
 * `existing` Worker. The older keys go once the new Worker runs; the new key goes when the deploy
 * fails. Fails with `NO_WORKERS_SUBDOMAIN` or `PLUGIN_DEPLOY_FAILED`.
 */
export async function deployWorker(
	apiKeys: ApiKeysService,
	manifest: PluginManifest,
	server: string,
	existing: { workerUrl: string | null; workerSecret: string | null } | null,
	origin: string
): Promise<DeployedWorker> {
	const script = pluginScriptName(POUCHBASE_INSTANCE, manifest.id);
	const secret = existing?.workerSecret ?? generateToken();
	let subdomain: string | null;

	try {
		subdomain = await driver.subdomain();
	} catch (error) {
		return deployFailure(error);
	}

	if (!subdomain) {
		fail({ code: 19011, message: 'NO_WORKERS_SUBDOMAIN' });
	}

	const issued = await apiKeys.issuePluginKey(manifest.id);

	if (issued.isErr()) {
		deployFailure(issued.error);
	}

	const apiKey = issued.value;

	try {
		await driver.deploy(script, {
			mainModule: ENTRY_MODULE,
			modules: workerModules(manifest, server),
			bindings: [
				{ type: 'secret_text', name: 'POUCHBASE_PLUGIN_SECRET', text: secret },
				{ type: 'plain_text', name: 'POUCHBASE_URL', text: origin },
				{ type: 'secret_text', name: 'POUCHBASE_API_KEY', text: apiKey.key }
			],
			message: `${manifest.id}@${manifest.version}`
		});

		if (!existing?.workerUrl) {
			await driver.enableSubdomain(script);
		}
	} catch (error) {
		// The key of a Worker that didn't deploy is of no use.
		await apiKeys.deleteFunctionKey(apiKey.id);

		return deployFailure(error);
	}

	// The Worker that runs now has the new key, so the older keys stop working.
	const kept = await apiKeys.keepPluginKey(manifest.id, apiKey.id);

	if (kept.isErr()) {
		console.error(`[plugins] Could not remove old API keys of ${manifest.id}`, kept.error);
	}

	return { url: `https://${script}.${subdomain}.workers.dev`, secret };
}

/** Deletes the plugin's Worker in the background; a failure is only logged. */
function deleteWorkerLater(pluginId: string) {
	background(
		driver.delete(pluginScriptName(POUCHBASE_INSTANCE, pluginId)).catch((error: unknown) => {
			console.error(`[plugins] Could not delete the Worker of ${pluginId}`, error);
		})
	);
}

/** `describe`, tried again while workers.dev doesn't serve a new Worker yet. */
async function describeWithRetries(
	runtime: PluginRuntime,
	context: PluginCallContext,
	attempts: number
) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await describePlugin(runtime, context);
		} catch (error) {
			if (!(error instanceof PluginCallError) || !error.retryable || attempt >= attempts) {
				throw error;
			}

			await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
		}
	}
}

/**
 * Asks the plugin's server code what it implements, with the plugin's settings, and checks it
 * has a handler for every sign-in provider the manifest contributes. A Worker that was just
 * deployed is asked again while workers.dev doesn't serve it yet. Fails with `PLUGIN_CALL_FAILED`.
 */
async function describeServer(
	runtime: PluginRuntime,
	manifest: PluginManifest,
	context: PluginCallContext,
	{ deployed }: { deployed: boolean }
): Promise<{ description: DescribeResult; configs: Map<string, ProviderConfig> }> {
	let description: DescribeResult;

	try {
		description = await describeWithRetries(runtime, context, deployed ? DESCRIBE_ATTEMPTS : 1);
	} catch (error) {
		return fail(
			{ code: 19009, message: 'PLUGIN_CALL_FAILED', data: { reason: describeError(error) } },
			error
		);
	}

	const result = providerConfigs(manifest, description.authProviders);

	if ('missing' in result) {
		fail({
			code: 19009,
			message: 'PLUGIN_CALL_FAILED',
			data: { reason: `The server code has no auth provider ${result.missing}` }
		});
	}

	return { description, configs: result.configs };
}

/**
 * Runs the server code where it belongs and asks it what it implements, with the plugin's
 * settings: in its own Worker, deployed here, or inside Pouchbase in development. A plugin without
 * server code gets no Worker (and loses the one of a previous version, with its API keys).
 */
export async function runServer(
	services: Services,
	runtimes: PluginRuntimes,
	manifest: PluginManifest,
	server: string | null,
	existing: PluginRow | null,
	context: PluginCallContext
): Promise<{
	worker: DeployedWorker | null;
	configs: Map<string, ProviderConfig>;
	description: DescribeResult | null;
}> {
	const deploys = server !== null && !RUN_INSTALLED_IN_PROCESS;

	if (!deploys) {
		if (existing?.workerUrl) {
			deleteWorkerLater(manifest.id);
		}

		const removed = await services.apiKeys().deletePluginKeys(manifest.id);

		if (removed.isErr()) {
			console.error(`[plugins] Could not remove the API keys of ${manifest.id}`, removed.error);
		}

		if (server === null) {
			return { worker: null, configs: new Map(), description: null };
		}
	}

	const worker = deploys
		? await deployWorker(services.apiKeys(), manifest, server, existing, runtimes.origin)
		: null;
	const runtime = worker
		? new WorkerRuntime(worker.url, worker.secret)
		: runtimes.inProcess(installedInProcess(manifest, server));

	try {
		return {
			worker,
			...(await describeServer(runtime, manifest, context, { deployed: !!worker }))
		};
	} catch (error) {
		// A new Worker that doesn't work is of no use; an updated one keeps its row.
		if (worker && !existing?.workerUrl) {
			deleteWorkerLater(manifest.id);
		}

		throw error;
	}
}

/**
 * Stores an installed plugin in one batch: its row, its sign-in providers (replacing those of the
 * previous version, or of the built-in plugin), its bundle in parts of up to 1.5 MB and its
 * compiled UI; returns the row.
 */
export async function storeInstalled(input: {
	manifest: PluginManifest;
	integrity: string;
	bytes: Uint8Array;
	ui: CompiledUi;
	worker: DeployedWorker | null;
	description: DescribeResult | null;
	configs: Map<string, ProviderConfig>;
}): Promise<InstalledRow> {
	const { manifest, worker } = input;
	const { id } = manifest;
	const now = new Date();
	const values = {
		name: manifest.name,
		version: manifest.version,
		apiVersion: manifest.apiVersion,
		manifest,
		integrity: input.integrity,
		registryUrl: registryUrl(),
		workerUrl: worker?.url ?? null,
		workerSecret: worker?.secret ?? null,
		capabilities: input.description,
		updatedAt: now
	};
	const providers = manifest.contributes.authProviders.map((contribution) =>
		providerRow(id, contribution, input.configs.get(contribution.id)!, now)
	);
	const modules = moduleRows(manifest, input.ui, now);
	const parts = splitBundle(new TextDecoder().decode(input.bytes));
	const [[row]] = await db.batch([
		db
			.insert(plugins)
			.values({ id, ...values, installedAt: now })
			.onConflictDoUpdate({ target: plugins.id, set: values })
			.returning(INSTALLED_COLUMNS),
		db.delete(pluginAuthProviders).where(eq(pluginAuthProviders.pluginId, id)),
		...(providers.length ? [db.insert(pluginAuthProviders).values(providers)] : []),
		db.delete(pluginBundleParts).where(eq(pluginBundleParts.pluginId, id)),
		...parts.map((data, part) => db.insert(pluginBundleParts).values({ pluginId: id, part, data })),
		db.delete(pluginModules).where(eq(pluginModules.pluginId, id)),
		...chunks(modules, MODULE_ROWS_PER_INSERT).map((rows) => db.insert(pluginModules).values(rows))
	]);

	return row!;
}

/** Removes every row of an installed plugin: the plugin, its API keys, providers, bundle, UI and settings. */
export async function removeInstalled(id: string) {
	await db.batch([
		db.delete(plugins).where(eq(plugins.id, id)),
		db.delete(apiKeyRows).where(eq(apiKeyRows.pluginId, id)),
		db.delete(pluginAuthProviders).where(eq(pluginAuthProviders.pluginId, id)),
		db.delete(pluginBundleParts).where(eq(pluginBundleParts.pluginId, id)),
		db.delete(pluginModules).where(eq(pluginModules.pluginId, id)),
		db.delete(pluginSettings).where(eq(pluginSettings.pluginId, id))
	]);
}
