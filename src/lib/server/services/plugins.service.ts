import type { ServiceError } from './base.service';
import type { CompiledUi, CompileIssue } from '../plugins/compile';
import type { PluginSettingsState } from '../plugins/settings';
import type {
	DescribeResult,
	FieldReadItem,
	FieldWriteItem,
	FieldWriteResult,
	PluginCallContext,
	PluginRuntime,
	ProviderConfig
} from '../plugins/runtime';
import type {
	AuthProviderContribution,
	ContributionSummary,
	ManifestIssue,
	PluginDetails,
	PluginList,
	PluginManifest,
	PluginPermissions
} from '@pouchbasejs/plugin-sdk';
import type { FieldColumn, PluginUser } from '@pouchbasejs/plugin-sdk/server';
import type { PluginGrant } from '../plugins/grant';
import type { BatchItem } from 'drizzle-orm/batch';
import type { ResultAsync } from 'neverthrow';
import type { PluginFieldTypeId } from '#lib/fields/field-types.js';
import type { SnapshotCollection } from '#lib/schemas/environments.js';

import { Pouchbase } from '@pouchbasejs/js-sdk';
import {
	DEFAULT_REGISTRY_URL,
	RegistryError,
	SERVER_FILE,
	SUPPORTED_API_VERSIONS,
	UI_DIR,
	checkCompatibility,
	contributionSummary,
	createRegistryClient,
	parseBundle,
	pluginCollectionName,
	pluginFieldTypeId,
	resolveSettings,
	splitPluginFieldType
} from '@pouchbasejs/plugin-sdk';
import { and, asc, eq, inArray, like, notInArray, sql } from 'drizzle-orm';
import { errAsync, fromPromise, okAsync } from 'neverthrow';

import { dev } from '$app/env';
import { POUCHBASE_INSTANCE, POUCHBASE_REGISTRY_URL } from '$app/env/private';
import { pluginImagePath } from '#lib/auth/oauth-providers.js';
import { apiCreateCollectionSchema } from '#lib/schemas/collections.js';

import { version as POUCHBASE_VERSION } from '../../../../package.json';
import { generateToken } from '../crypto';
import {
	apiKeys,
	collections,
	fields,
	pluginAuthProviders,
	pluginModules,
	pluginSettings,
	plugins
} from '../db';
import { functions as driver, PlatformError } from '../platform';
import { background } from '../platform/runtime';
import { compileUi, formatCompileIssue } from '../plugins/compile';
import {
	describeEmbedded,
	embeddedPlugin,
	embeddedPlugins,
	InProcessRuntime
} from '../plugins/embedded';
import { collectionFields, collectionIndexes } from '../plugins/collections';
import { hasHooks, passThroughWrite, readInChunks } from '../plugins/field-values';
import { internalKeyFor } from '../plugins/internal-keys';
import { matchPage } from '../plugins/requests';
import {
	describePlugin,
	PluginCallError,
	readFieldValues,
	withCallContext,
	writeFieldValues
} from '../plugins/runtime';
import { applySettings, missingSettings, settingsState } from '../plugins/settings';
import { ENTRY_MODULE, pluginScriptName, WorkerRuntime, workerModules } from '../plugins/worker';
import { Service } from './base.service';

/**
 * Plugins: those installed from a plugin registry (the public one on pouchbase.io, or
 * `POUCHBASE_REGISTRY_URL`) and the built-in ones from `plugins/*` (`../plugins/embedded.ts`). The
 * registry API, the manifest and the bundle format come from `@pouchbasejs/plugin-sdk`.
 *
 * Installing downloads the bundle, checks it against its integrity hash and the manifest rules,
 * compiles its UI for the dashboard (`../plugins/compile.ts`, stored in `plugin_modules`), deploys
 * its server code to a Worker of its own (`../plugins/worker.ts`), stores what `describe` reports
 * (`plugins.capabilities`) and registers the sign-in providers it contributes in
 * `plugin_auth_providers`, with the URLs and scopes the plugin reports. Built-in plugins run inside
 * Pouchbase and register their providers through `ensureEmbedded()`; their UI is compiled by Vite
 * with the dashboard. Installing a plugin with the same id from the registry shadows the built-in
 * one.
 *
 * A plugin's routes answer at `/api/plugins/<id>/<path>` (`route()`), its pages open at
 * `/plugins/<id>/<path>` (`page()`), its field types run through `writeFieldValues()` and
 * `readFieldValues()`, and its settings (`plugin_settings`) reach every call as `ctx.settings`.
 */

/** Results per page when searching the registry. */
const PER_PAGE = 24;

/** How often `describe` is tried right after a deploy, while workers.dev picks up the Worker. */
const DESCRIBE_ATTEMPTS = 5;

/** Rows of `plugin_modules` per insert; D1 binds at most 100 values per statement. */
const MODULE_ROWS_PER_INSERT = 15;

/** A page of a plugin in the dashboard, at `/plugins/<plugin>/<path>`. */
export type PluginPage = {
	path: string;
	title: string;
	/** Whether the sidebar links to it. */
	navigation: boolean;
	/** The page's own icon (`icon` of the contribution), served by Pouchbase; `null` without one. */
	iconUrl: string | null;
};

/** An installed plugin as the Plugins page shows it; without the bundle. */
export type InstalledPlugin = {
	id: string;
	name: string;
	version: string;
	apiVersion: number;
	description: string;
	/** The plugin's icon (`manifest.icon`), served by Pouchbase; `null` when it has none. */
	iconUrl: string | null;
	permissions: PluginPermissions;
	/** What the plugin adds, with the routes its server code reported. */
	contributes: ContributionSummary;
	pages: PluginPage[];
	/** Whether the plugin has settings an admin can fill in. */
	hasSettings: boolean;
	/** Keys of required settings without a value; the plugin may not work until they are set. */
	missingSettings: string[];
	/** Built in: ships with Pouchbase, runs inside it and can't be removed. */
	embedded: boolean;
	/** Installed from the registry in place of the built-in plugin with this id. */
	replacesBuiltIn: boolean;
	/** `null` for a built-in plugin. */
	registryUrl: string | null;
	installedAt: Date | null;
	updatedAt: Date | null;
};

/** A field type a plugin contributes, as the field settings and the record form use it. */
export type PluginFieldType = {
	/** `<plugin>:<type>`, as stored in `fields.type`. */
	id: PluginFieldTypeId;
	pluginId: string;
	pluginName: string;
	/** The version of the plugin, for loading its components (`loadPluginComponent`). */
	pluginVersion: string;
	/** Whether the plugin is built in (its components come with the dashboard). */
	embedded: boolean;
	/** The plugin's own id of the type, e.g. `rating`. */
	type: string;
	label: string;
	description: string | null;
	column: FieldColumn;
	/** Bundle path of the input component, e.g. `ui/rating-input.svelte`. */
	input: string;
	/**
	 * Bundle path of the preview component, which shows the value, read-only, in the records grid;
	 * `null` shows the value as text.
	 */
	preview: string | null;
	/**
	 * The type's own icon (`icon` of the contribution), drawn in one color like the built-in types'
	 * icons; `null` without one (never the plugin's logo).
	 */
	iconUrl: string | null;
};

/** The page `/plugins/<plugin>/<path>` opens. */
export type PluginPageMatch = {
	plugin: InstalledPlugin;
	page: PluginPage & { component: string };
	/** The rest of the path below the page, e.g. `2026/10`; empty for the page itself. */
	params: string;
};

/** The compiled UI of an installed plugin, for the dashboard's module loader. */
export type PluginModules = {
	version: string;
	/** Bundle path → ES module and the specifiers it imports (host modules and bundle paths). */
	modules: Record<string, { code: string; imports: string[] }>;
	/** Contents of the plugin's `.css` files, by path. */
	css: string[];
};

/** A field of a collection that has a plugin's field type. */
export type PluginFieldUsage = { collection: string; field: string; type: string };

/** A file of a plugin served to browsers, e.g. a sign-in provider's logo. */
export type PluginAsset = { content: string; contentType: string };

type RegistryFailed = ServiceError<19000, 'REGISTRY_REQUEST_FAILED'> & {
	data: { status: number; reason: string };
};

type ListFailed = ServiceError<19001, 'LIST_PLUGINS_FAILED'>;

type Incompatible = ServiceError<19003, 'PLUGIN_INCOMPATIBLE'> & { data: { reason: string } };

type InvalidBundle = ServiceError<19004, 'INVALID_BUNDLE'> & { data: { issues: ManifestIssue[] } };

type InstallFailed = ServiceError<19005, 'INSTALL_FAILED'>;

type UninstallFailed = ServiceError<19006, 'UNINSTALL_FAILED'>;

type DeployFailed = ServiceError<19007, 'PLUGIN_DEPLOY_FAILED'> & { data: { reason: string } };

type ProviderTaken = ServiceError<19008, 'PROVIDER_ID_TAKEN'> & {
	data: { provider: string; pluginId: string };
};

type CallFailed = ServiceError<19009, 'PLUGIN_CALL_FAILED'> & { data: { reason: string } };

type BuiltIn = ServiceError<19010, 'PLUGIN_BUILT_IN'>;

type NoSubdomain = ServiceError<19011, 'NO_WORKERS_SUBDOMAIN'>;

type SyncFailed = ServiceError<19012, 'SYNC_BUILT_IN_PLUGINS_FAILED'>;

type RouteFailed = ServiceError<19013, 'PLUGIN_ROUTE_FAILED'> & { data: { reason: string } };

type UiCompileFailed = ServiceError<19014, 'UI_COMPILE_FAILED'> & {
	data: { issues: CompileIssue[] };
};

type LoadModulesFailed = ServiceError<19015, 'LOAD_MODULES_FAILED'>;

type FieldTypeNotInstalled = ServiceError<19016, 'FIELD_TYPE_NOT_INSTALLED'> & {
	data: { pluginId: string; type: string | null };
};

type FieldCallFailed = ServiceError<19017, 'FIELD_CALL_FAILED'> & { data: { reason: string } };

type InvalidSettings = ServiceError<19018, 'INVALID_PLUGIN_SETTINGS'> & {
	data: { issues: Record<string, string> };
};

type SaveSettingsFailed = ServiceError<19019, 'SAVE_PLUGIN_SETTINGS_FAILED'>;

type CollectionTaken = ServiceError<19020, 'PLUGIN_COLLECTION_TAKEN'> & { data: { name: string } };

type InvalidCollection = ServiceError<19021, 'INVALID_PLUGIN_COLLECTION'> & {
	data: { issues: ManifestIssue[] };
};

type CollectionsFailed = ServiceError<19022, 'PLUGIN_COLLECTIONS_FAILED'>;

type CollectionInUse = ServiceError<19023, 'PLUGIN_COLLECTION_IN_USE'> & {
	data: { collection: string; field: string; target: string };
};

type PluginRow = typeof plugins.$inferSelect;

type ProviderRow = typeof pluginAuthProviders.$inferInsert;

type ModuleRow = typeof pluginModules.$inferInsert;

/** Saved settings by plugin id. */
type SavedSettings = Map<string, Record<string, string>>;

function registryUrl() {
	return POUCHBASE_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
}

const HOST = { version: POUCHBASE_VERSION, apiVersions: SUPPORTED_API_VERSIONS };

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

/** Every column of `plugins` but the bundle, which can be a megabyte. */
const INSTALLED_COLUMNS = {
	id: plugins.id,
	name: plugins.name,
	version: plugins.version,
	apiVersion: plugins.apiVersion,
	manifest: plugins.manifest,
	registryUrl: plugins.registryUrl,
	workerUrl: plugins.workerUrl,
	workerSecret: plugins.workerSecret,
	capabilities: plugins.capabilities,
	installedAt: plugins.installedAt,
	updatedAt: plugins.updatedAt
};

type InstalledRow = Omit<PluginRow, 'bundle' | 'integrity'>;

/**
 * A plugin that is there: installed from the registry (`row`), or built in and not shadowed by an
 * installed one (`row` is `null`).
 */
type PluginSource = { manifest: PluginManifest; row: InstalledRow | null };

/** The URL of an image of the plugin (its icon, or that of a contribution); `null` without. */
function imageUrl(manifest: PluginManifest, path: string | undefined) {
	return path ? pluginImagePath(manifest.id, path, manifest.version) : null;
}

function iconUrl(manifest: PluginManifest) {
	return imageUrl(manifest, manifest.icon);
}

function pagesOf(manifest: PluginManifest): PluginPage[] {
	return manifest.contributes.pages.map(({ path, title, navigation, icon }) => ({
		path,
		title,
		navigation,
		iconUrl: imageUrl(manifest, icon)
	}));
}

function toInstalled(
	source: PluginSource,
	saved: Readonly<Record<string, string>>,
	routes: readonly string[]
): InstalledPlugin {
	const { manifest, row } = source;

	return {
		id: manifest.id,
		name: row?.name ?? manifest.name,
		version: row?.version ?? manifest.version,
		apiVersion: row?.apiVersion ?? manifest.apiVersion,
		description: manifest.description,
		iconUrl: iconUrl(manifest),
		permissions: manifest.permissions,
		contributes: contributionSummary(manifest, routes),
		pages: pagesOf(manifest),
		hasSettings: manifest.settings.length > 0,
		missingSettings: missingSettings(manifest.settings, saved),
		embedded: row === null,
		replacesBuiltIn: row !== null && embeddedPlugin(manifest.id) !== null,
		registryUrl: row?.registryUrl ?? null,
		installedAt: row?.installedAt ?? null,
		updatedAt: row?.updatedAt ?? null
	};
}

function toFieldTypes(manifest: PluginManifest, embedded: boolean): PluginFieldType[] {
	return manifest.contributes.fields.map((field) => ({
		id: pluginFieldTypeId(manifest.id, field.type),
		pluginId: manifest.id,
		pluginName: manifest.name,
		pluginVersion: manifest.version,
		embedded,
		type: field.type,
		label: field.label,
		description: field.description || null,
		column: field.column,
		input: field.input,
		preview: field.preview ?? null,
		iconUrl: imageUrl(manifest, field.icon)
	}));
}

/** The rows of `plugin_modules` for a compiled UI. */
function moduleRows(manifest: PluginManifest, ui: CompiledUi, updatedAt: Date): ModuleRow[] {
	return [
		...Object.entries(ui.modules).map(([path, module]) => ({
			pluginId: manifest.id,
			path,
			version: manifest.version,
			code: module.code,
			imports: module.imports,
			updatedAt
		})),
		...Object.entries(ui.css).map(([path, code]) => ({
			pluginId: manifest.id,
			path,
			version: manifest.version,
			code,
			imports: [],
			updatedAt
		}))
	];
}

function chunks<T>(items: readonly T[], size: number): T[][] {
	const result: T[][] = [];

	for (let start = 0; start < items.length; start += size) {
		result.push(items.slice(start, start + size));
	}

	return result;
}

/** The API's messages, e.g. the syntax error a deploy failed with. */
function reason(error: unknown) {
	if (error instanceof PlatformError && error.errors.length) {
		return error.errors.map((item) => item.message).join('; ');
	}

	return error instanceof Error ? error.message : String(error);
}

function providerRow(
	pluginId: string,
	contribution: AuthProviderContribution,
	config: ProviderConfig,
	updatedAt: Date
): ProviderRow {
	return {
		provider: contribution.id,
		pluginId,
		label: contribution.label,
		consoleUrl: contribution.consoleUrl ?? null,
		icon: contribution.icon ?? null,
		authorizeUrl: config.authorizeUrl,
		tokenUrl: config.tokenUrl,
		scopes: config.scopes,
		pkce: config.pkce,
		updatedAt
	};
}

function sameProvider(a: ProviderRow, b: ProviderRow) {
	return (
		a.pluginId === b.pluginId &&
		a.label === b.label &&
		(a.consoleUrl ?? null) === (b.consoleUrl ?? null) &&
		(a.icon ?? null) === (b.icon ?? null) &&
		a.authorizeUrl === b.authorizeUrl &&
		a.tokenUrl === b.tokenUrl &&
		JSON.stringify(a.scopes) === JSON.stringify(b.scopes) &&
		a.pkce === b.pkce
	);
}

/** The config of every provider the manifest contributes, from the plugin's `describe`. */
function providerConfigs(
	manifest: PluginManifest,
	described: Record<string, ProviderConfig>
): { configs: Map<string, ProviderConfig> } | { missing: string } {
	const configs = new Map<string, ProviderConfig>();

	for (const contribution of manifest.contributes.authProviders) {
		const config = described[contribution.id];

		if (!config) {
			return { missing: contribution.id };
		}

		configs.set(contribution.id, config);
	}

	return { configs };
}

/** Saved settings rows grouped by plugin. */
function groupSettings(rows: { pluginId: string; key: string; value: string }[]): SavedSettings {
	const saved: SavedSettings = new Map();

	for (const row of rows) {
		const values = saved.get(row.pluginId) ?? {};

		values[row.key] = row.value;
		saved.set(row.pluginId, values);
	}

	return saved;
}

/** The context of a call into a plugin: its settings with their defaults. */
function callContext(
	manifest: PluginManifest,
	saved: Readonly<Record<string, string>>
): PluginCallContext {
	return { settings: resolveSettings(manifest.settings, saved) };
}

/** Runs `steps` one after the other, until one fails. */
function inSequence<E>(steps: (() => ResultAsync<unknown, E>)[]): ResultAsync<void, E> {
	return steps.reduce<ResultAsync<void, E>>(
		(chain, step) => chain.andThen(() => step().map(() => undefined)),
		okAsync(undefined)
	);
}

/** Built-in plugins whose collections this isolate brought in line, as `<id>@<version>`. */
const appliedEmbedded = new Set<string>();

/** Logos and other images in `ui/`; the only plugin files served to browsers. */
const ASSET_PATH = /^ui\/(?:[\w-]+\/)*[\w.-]+\.svg$/;

/** Files of a bundle that `compileUi` turns into `plugin_modules`. */
const UI_MODULE_FILE = /\.(?:svelte|js|css)$/;

export class PluginsService extends Service {
	private readonly registry = createRegistryClient({ url: registryUrl() });

	private registryError(error: unknown): RegistryFailed {
		return {
			...this.error(19000, 'REGISTRY_REQUEST_FAILED', error),
			data: {
				status: error instanceof RegistryError ? error.status : 0,
				reason: error instanceof Error ? error.message : String(error)
			}
		};
	}

	private callFailed(error: unknown): CallFailed {
		return { ...this.error(19009, 'PLUGIN_CALL_FAILED', error), data: { reason: reason(error) } };
	}

	private listFailed(error: unknown): ListFailed {
		return this.error(19001, 'LIST_PLUGINS_FAILED', error);
	}

	/** Plugins in the registry that this Pouchbase can run, matching `query` (and `category`). */
	search(query: string, page = 1, category?: string): ResultAsync<PluginList, RegistryFailed> {
		return fromPromise(
			this.registry.search({
				query,
				category,
				page,
				perPage: PER_PAGE,
				apiVersions: SUPPORTED_API_VERSIONS
			}),
			(error) => this.registryError(error)
		);
	}

	/** A plugin with its versions and readme; `null` when the registry doesn't have it. */
	details(id: string): ResultAsync<PluginDetails | null, RegistryFailed> {
		return fromPromise(this.registry.get(id), (error) => this.registryError(error));
	}

	/** Installed plugins and the built-in ones they don't shadow, by name. */
	installed(): ResultAsync<InstalledPlugin[], ListFailed> {
		return this.ensureEmbedded()
			.orElse((failure) => {
				console.error('[plugins] Could not register the built-in plugins', failure);

				return okAsync(undefined);
			})
			.andThen(() => this.sources())
			.andThen((sources) =>
				this.savedSettings(sources.map((source) => source.manifest.id)).andThen((saved) =>
					fromPromise(
						Promise.all(
							sources.map(async (source) =>
								toInstalled(
									source,
									saved.get(source.manifest.id) ?? {},
									(await this.capabilities(source, saved))?.routes ?? []
								)
							)
						),
						(error) => this.listFailed(error)
					)
				)
			)
			.map((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
	}

	/**
	 * Installs the newest version of a plugin that this Pouchbase can run (or the `requested` one), or
	 * updates an installed plugin to it. The UI is compiled before the Worker is deployed, so a
	 * plugin whose components don't compile changes nothing.
	 */
	install(
		id: string,
		/** A publish installs the version the development instance has. */
		requested = 'latest'
	): ResultAsync<
		InstalledPlugin,
		| RegistryFailed
		| ListFailed
		| ServiceError<19002, 'PLUGIN_NOT_FOUND'>
		| Incompatible
		| InvalidBundle
		| InstallFailed
		| DeployFailed
		| ProviderTaken
		| CallFailed
		| NoSubdomain
		| UiCompileFailed
		| CollectionTaken
		| InvalidCollection
		| CollectionsFailed
	> {
		return (
			fromPromise(this.registry.getVersion(id, requested, SUPPORTED_API_VERSIONS), (error) =>
				this.registryError(error)
			)
				.andThen((version) => {
					if (!version) {
						return errAsync(this.error(19002, 'PLUGIN_NOT_FOUND'));
					}

					const reason = incompatibility({
						apiVersion: version.apiVersion,
						engines: { pouchbase: version.pouchbase ?? undefined }
					});

					if (reason) {
						return errAsync({ ...this.error(19003, 'PLUGIN_INCOMPATIBLE'), data: { reason } });
					}

					return fromPromise(this.registry.download(version), (error) =>
						this.registryError(error)
					).map((bytes) => ({ version, bytes }));
				})
				.andThen(({ version, bytes }) => {
					const result = parseBundle(bytes);
					const invalid = (issues: ManifestIssue[]): InvalidBundle => ({
						...this.error(19004, 'INVALID_BUNDLE'),
						data: { issues }
					});

					if (!result.success) {
						return errAsync(invalid(result.issues));
					}

					const { bundle } = result;
					const { manifest } = bundle;

					// The registry must serve what it listed; anything else is a broken or hostile registry.
					if (manifest.id !== id || manifest.version !== version.version) {
						return errAsync(
							invalid([
								{
									path: 'manifest',
									message: `Expected ${id}@${version.version}, got ${manifest.id}@${manifest.version}`
								}
							])
						);
					}

					// Checked again on the manifest itself, which may differ from what the registry listed.
					const reason = incompatibility(manifest);

					if (reason) {
						return errAsync({ ...this.error(19003, 'PLUGIN_INCOMPATIBLE'), data: { reason } });
					}

					return okAsync({
						version,
						bytes,
						manifest,
						files: bundle.files,
						server: bundle.files[SERVER_FILE] ?? null
					});
				})
				.andThen((input) =>
					this.checkProviderIds(input.manifest)
						.andThen(() => this.findRow(input.manifest.id))
						.map((existing) => ({ ...input, existing }))
				)
				.andThen((input) => this.compile(input.files).map((ui) => ({ ...input, ui })))
				// Before the Worker runs, so its first call finds the collections.
				.andThen((input) => this.applyCollections(input.manifest).map(() => input))
				.andThen((input) =>
					this.savedSettings([id]).map((saved) => ({
						...input,
						context: callContext(input.manifest, saved.get(id) ?? {}),
						saved: saved.get(id) ?? {}
					}))
				)
				.andThen(({ version, bytes, manifest, server, existing, ui, context, saved }) =>
					this.runServer(manifest, server, existing, context).andThen(
						({ worker, configs, description }) => {
							const now = new Date();
							const values = {
								name: manifest.name,
								version: manifest.version,
								apiVersion: manifest.apiVersion,
								manifest,
								bundle: new TextDecoder().decode(bytes),
								integrity: version.integrity,
								registryUrl: registryUrl(),
								workerUrl: worker?.url ?? null,
								workerSecret: worker?.secret ?? null,
								capabilities: description,
								updatedAt: now
							};
							const providers = manifest.contributes.authProviders.map((contribution) =>
								providerRow(manifest.id, contribution, configs.get(contribution.id)!, now)
							);
							const modules = moduleRows(manifest, ui, now);

							return fromPromise(
								this.db.batch([
									this.db
										.insert(plugins)
										.values({ id, ...values, installedAt: now })
										.onConflictDoUpdate({ target: plugins.id, set: values })
										.returning(INSTALLED_COLUMNS),
									// Replaces the providers of the previous version, or of the built-in plugin.
									this.db.delete(pluginAuthProviders).where(eq(pluginAuthProviders.pluginId, id)),
									...(providers.length
										? [this.db.insert(pluginAuthProviders).values(providers)]
										: []),
									// Replaces the modules of the previous version.
									this.db.delete(pluginModules).where(eq(pluginModules.pluginId, id)),
									...chunks(modules, MODULE_ROWS_PER_INSERT).map((rows) =>
										this.db.insert(pluginModules).values(rows)
									)
								]),
								(error) => this.error(19005, 'INSTALL_FAILED', error)
							).map(([[row]]) =>
								toInstalled({ manifest, row: row! }, saved, description?.routes ?? [])
							);
						}
					)
				)
		);
	}

	/**
	 * Removes an installed plugin with its collections and their records, its Worker, its API key,
	 * sign-in providers, compiled UI and settings; `null` when it isn't installed. Fails with
	 * `PLUGIN_COLLECTION_IN_USE`, changing nothing, while a relation field of another collection
	 * points to one of its collections. A built-in plugin can't be removed; removing a plugin that
	 * shadowed one brings the built-in plugin back, with collections of its own. Fields with the
	 * plugin's types in other collections keep their data.
	 */
	uninstall(
		id: string
	): ResultAsync<
		{ id: string } | null,
		ListFailed | UninstallFailed | BuiltIn | CollectionInUse | CollectionsFailed
	> {
		return this.findRow(id).andThen((row) => {
			if (!row) {
				return embeddedPlugin(id) ? errAsync(this.error(19010, 'PLUGIN_BUILT_IN')) : okAsync(null);
			}

			// The collections go first: while one can't, the plugin stays installed and keeps working.
			return this.deleteCollections(id).andThen(() =>
				this.removeInstalled(id, row.workerUrl !== null)
			);
		});
	}

	/** The names of the plugin's collections (those with its `plugin_id`), sorted. */
	ownCollections(pluginId: string): ResultAsync<string[], ListFailed> {
		return fromPromise(
			this.db
				.select({ name: collections.name })
				.from(collections)
				.where(eq(collections.pluginId, pluginId))
				.orderBy(asc(collections.name)),
			(error) => this.listFailed(error)
		).map((rows) => rows.map((row) => row.name));
	}

	/**
	 * Deletes the plugin's collections with their records. Checks first that no relation field of
	 * another collection points to one of them; relations between them are no obstacle, as each
	 * round deletes those nothing points to anymore.
	 */
	private deleteCollections(
		pluginId: string
	): ResultAsync<void, ListFailed | CollectionInUse | CollectionsFailed> {
		const failed = (error: unknown): CollectionsFailed =>
			this.error(19022, 'PLUGIN_COLLECTIONS_FAILED', error);

		return fromPromise(
			this.db
				.select({ id: collections.id, name: collections.name })
				.from(collections)
				.where(eq(collections.pluginId, pluginId)),
			(error) => this.listFailed(error)
		).andThen((own) => {
			if (!own.length) {
				return okAsync(undefined);
			}

			const ids = own.map((collection) => collection.id);

			return fromPromise(
				this.db
					.select({
						collection: collections.name,
						field: fields.name,
						target: sql<string>`json_extract(${fields.options}, '$.collectionId')`
					})
					.from(fields)
					.innerJoin(collections, eq(fields.collectionId, collections.id))
					.where(
						and(
							eq(fields.type, 'relation'),
							notInArray(fields.collectionId, ids),
							inArray(sql`json_extract(${fields.options}, '$.collectionId')`, ids)
						)
					)
					.limit(1),
				(error) => this.listFailed(error)
			).andThen(([reference]) => {
				if (reference) {
					return errAsync<never, CollectionInUse>({
						...this.error(19023, 'PLUGIN_COLLECTION_IN_USE'),
						data: {
							collection: reference.collection,
							field: reference.field,
							target: own.find((item) => item.id === reference.target)?.name ?? reference.target
						}
					});
				}

				const service = this.services.collections();

				return fromPromise(
					(async () => {
						let pending = own.map((collection) => collection.name);

						while (pending.length) {
							const left: string[] = [];

							for (const name of pending) {
								const result = await service.delete(name);

								// Another of the plugin's collections still points to it: the next round.
								if (result.isErr() && result.error.code === 6009) {
									left.push(name);
								} else if (result.isErr() && result.error.code !== 6006) {
									throw result.error;
								}
							}

							if (left.length === pending.length) {
								throw new Error(`The collections ${left.join(', ')} point to each other`);
							}

							pending = left;
						}
					})(),
					failed
				);
			});
		});
	}

	/** Removes the rows and the Worker of an installed plugin; see `uninstall`. */
	private removeInstalled(
		id: string,
		hasWorker: boolean
	): ResultAsync<{ id: string }, UninstallFailed> {
		return fromPromise(
			(async () => {
				if (hasWorker) {
					await driver.delete(pluginScriptName(POUCHBASE_INSTANCE, id));
				}

				await this.db.batch([
					this.db.delete(plugins).where(eq(plugins.id, id)),
					this.db.delete(apiKeys).where(eq(apiKeys.pluginId, id)),
					this.db.delete(pluginAuthProviders).where(eq(pluginAuthProviders.pluginId, id)),
					this.db.delete(pluginModules).where(eq(pluginModules.pluginId, id)),
					this.db.delete(pluginSettings).where(eq(pluginSettings.pluginId, id))
				]);

				return { id };
			})(),
			(error) => this.error(19006, 'UNINSTALL_FAILED', error)
		).andThen((removed) => {
			if (!embeddedPlugin(id)) {
				return okAsync(removed);
			}

			// The built-in plugin sets up its collections again, which went with the installed one.
			for (const key of appliedEmbedded) {
				if (key.startsWith(`${id}@`)) {
					appliedEmbedded.delete(key);
				}
			}

			return this.ensureEmbedded()
				.orElse((failure) => {
					console.error(`[plugins] Could not bring back the built-in ${id}`, failure);

					return okAsync(undefined);
				})
				.map(() => removed);
		});
	}

	/**
	 * Brings `plugin_auth_providers` in line with the built-in plugins of this build: registers the
	 * providers of every built-in plugin that no installed plugin shadows, and removes rows of
	 * plugins that are neither installed nor built in. Writes only when something changed, so it is
	 * cheap to call before reading the providers.
	 */
	ensureEmbedded(): ResultAsync<void, SyncFailed> {
		return fromPromise(
			(async () => {
				const [installedRows, rows, settingRows] = await this.db.batch([
					this.db.select({ id: plugins.id }).from(plugins),
					this.db.select().from(pluginAuthProviders),
					this.db.select().from(pluginSettings)
				]);
				const installed = new Set(installedRows.map((row) => row.id));
				const saved = groupSettings(settingRows);
				const active = embeddedPlugins().filter((plugin) => !installed.has(plugin.manifest.id));
				const activeIds = new Set(active.map((plugin) => plugin.manifest.id));
				const now = new Date();
				const desired: ProviderRow[] = [];

				for (const plugin of active) {
					const description = await describeEmbedded(
						plugin,
						callContext(plugin.manifest, saved.get(plugin.manifest.id) ?? {})
					);

					for (const contribution of plugin.manifest.contributes.authProviders) {
						const config = description.authProviders[contribution.id];
						const holder = rows.find((row) => row.provider === contribution.id);

						if (!config) {
							console.error(
								`[plugins] The built-in ${plugin.manifest.id} has no handler for ${contribution.id}`
							);
							continue;
						}

						// An installed plugin that took the id before this build shipped it keeps it.
						if (
							holder &&
							holder.pluginId !== plugin.manifest.id &&
							installed.has(holder.pluginId)
						) {
							console.warn(
								`[plugins] ${contribution.id} belongs to ${holder.pluginId}; skipping the built-in ${plugin.manifest.id}`
							);
							continue;
						}

						desired.push(providerRow(plugin.manifest.id, contribution, config, now));
					}
				}

				const stale = rows.filter(
					(row) =>
						(!installed.has(row.pluginId) && !activeIds.has(row.pluginId)) ||
						(activeIds.has(row.pluginId) && !desired.some((item) => item.provider === row.provider))
				);
				const changed = desired.filter((item) => {
					const row = rows.find((existing) => existing.provider === item.provider);

					return !row || !sameProvider(row, item);
				});
				const statements: BatchItem<'sqlite'>[] = [
					...(stale.length
						? [
								this.db.delete(pluginAuthProviders).where(
									inArray(
										pluginAuthProviders.provider,
										stale.map((row) => row.provider)
									)
								)
							]
						: []),
					...changed.map((item) =>
						this.db
							.insert(pluginAuthProviders)
							.values(item)
							.onConflictDoUpdate({ target: pluginAuthProviders.provider, set: item })
					)
				];

				if (statements.length) {
					await this.db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
				}

				// Once per version and isolate: a plugin's collections change only with the plugin.
				for (const { manifest } of active) {
					const key = `${manifest.id}@${manifest.version}`;

					if (!manifest.contributes.collections.length || appliedEmbedded.has(key)) {
						continue;
					}

					const applied = await this.applyCollections(manifest);

					if (applied.isErr()) {
						console.error(
							`[plugins] Could not set up the collections of the built-in ${manifest.id}`,
							applied.error
						);
						continue;
					}

					appliedEmbedded.add(key);
				}
			})(),
			(error) => this.error(19012, 'SYNC_BUILT_IN_PLUGINS_FAILED', error)
		);
	}

	/**
	 * What the plugin may do through the records API (`ctx.pouch`): read and write the collections
	 * of its `permissions.collections`, and its own collections (those with its `plugin_id`). `null`
	 * when the plugin isn't there.
	 */
	grant(pluginId: string): ResultAsync<PluginGrant | null, ListFailed> {
		return this.source(pluginId).andThen((source) => {
			if (!source) {
				return okAsync(null);
			}

			return fromPromise(
				this.db
					.select({ name: collections.name })
					.from(collections)
					.where(eq(collections.pluginId, pluginId)),
				(error) => this.listFailed(error)
			).map((rows) => {
				const own = rows.map((row) => row.name);
				const { read, write } = source.manifest.permissions.collections;
				const names = (list: string[]): PluginGrant['read'] =>
					list.includes('*') ? '*' : new Set([...list, ...own]);

				return { pluginId, read: names(read), write: names(write) };
			});
		});
	}

	/**
	 * What runs the plugin's server code: its Worker when installed, Pouchbase itself when built in.
	 * Calls that don't pass a context of their own get the plugin's settings. `null` when the plugin
	 * isn't there or has no server code.
	 */
	runtimeFor(pluginId: string): ResultAsync<PluginRuntime | null, ListFailed> {
		return this.source(pluginId).andThen((source) => {
			const runtime = source ? this.runtimeOf(source) : null;

			if (!source || !runtime) {
				return okAsync(null);
			}

			return this.savedSettings([pluginId]).map((saved) =>
				withCallContext(runtime, callContext(source.manifest, saved.get(pluginId) ?? {}))
			);
		});
	}

	/**
	 * Runs the plugin's route for `request`: `path` is the path below `/api/plugins/<id>` as the
	 * client sent it (still URL-encoded, e.g. `/items/42`), `caller` who the plugin sees as
	 * `ctx.admin` and `ctx.user`. The response is the plugin's own, or 404/405 JSON when no route
	 * matches; `null` when the plugin isn't there or has no server code.
	 */
	route(
		pluginId: string,
		request: Request,
		path: string,
		caller: { admin: boolean; user: PluginUser | null }
	): ResultAsync<Response | null, ListFailed | RouteFailed> {
		return this.source(pluginId).andThen((source) => {
			const runtime = source ? this.runtimeOf(source) : null;

			if (!source || !runtime) {
				return okAsync(null);
			}

			return this.savedSettings([pluginId]).andThen((saved) =>
				fromPromise(
					runtime.route(
						request,
						{ path: path.startsWith('/') ? path : `/${path}`, search: new URL(request.url).search },
						{
							...callContext(source.manifest, saved.get(pluginId) ?? {}),
							admin: caller.admin,
							user: caller.user
						}
					),
					(error): RouteFailed => ({
						...this.error(19013, 'PLUGIN_ROUTE_FAILED', error),
						data: { reason: reason(error) }
					})
				)
			);
		});
	}

	/**
	 * The compiled UI of an installed plugin; `null` when it isn't installed or is built in (the
	 * dashboard has the components of built-in plugins already). A plugin installed before its UI
	 * was compiled on install is compiled now, from its stored bundle.
	 */
	modules(pluginId: string): ResultAsync<PluginModules | null, ListFailed | LoadModulesFailed> {
		return fromPromise(
			this.db.select(INSTALLED_COLUMNS).from(plugins).where(eq(plugins.id, pluginId)),
			(error) => this.listFailed(error)
		).andThen(([row]) => {
			if (!row) {
				return okAsync(null);
			}

			return fromPromise(
				(async () => {
					let rows = await this.db
						.select({
							path: pluginModules.path,
							code: pluginModules.code,
							imports: pluginModules.imports
						})
						.from(pluginModules)
						.where(
							and(eq(pluginModules.pluginId, pluginId), eq(pluginModules.version, row.version))
						);

					if (!rows.length) {
						rows = await this.compileStored(row.manifest);
					}

					const result: PluginModules = { version: row.version, modules: {}, css: [] };

					for (const module of rows.sort((a, b) => a.path.localeCompare(b.path))) {
						if (module.path.endsWith('.css')) {
							result.css.push(module.code);
						} else {
							result.modules[module.path] = { code: module.code, imports: module.imports };
						}
					}

					return result;
				})(),
				(error) => this.error(19015, 'LOAD_MODULES_FAILED', error)
			);
		});
	}

	/**
	 * The page that `/plugins/<pluginId>/<path>` opens: the plugin's page with the longest path that
	 * `path` starts with, and the rest of `path` as `params`. `null` when there is none.
	 */
	page(pluginId: string, path: string): ResultAsync<PluginPageMatch | null, ListFailed> {
		return this.source(pluginId).andThen((source) => {
			const match = source ? matchPage(source.manifest.contributes.pages, path) : null;

			if (!source || !match) {
				return okAsync(null);
			}

			return this.savedSettings([pluginId]).andThen((saved) =>
				fromPromise(this.capabilities(source, saved), (error) => this.listFailed(error)).map(
					(capabilities): PluginPageMatch => ({
						plugin: toInstalled(source, saved.get(pluginId) ?? {}, capabilities?.routes ?? []),
						page: {
							path: match.page.path,
							title: match.page.title,
							component: match.page.component,
							navigation: match.page.navigation,
							iconUrl: imageUrl(source.manifest, match.page.icon)
						},
						params: match.params
					})
				)
			);
		});
	}

	/** The field types of the installed and built-in plugins, by plugin and then in manifest order. */
	fieldTypes(): ResultAsync<PluginFieldType[], ListFailed> {
		return this.sources().map((sources) =>
			sources
				.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
				.flatMap((source) => toFieldTypes(source.manifest, source.row === null))
		);
	}

	/** A plugin's field type by its id (`<plugin>:<type>`); `null` when no plugin there has it. */
	fieldType(id: string): ResultAsync<PluginFieldType | null, ListFailed> {
		const parts = splitPluginFieldType(id);

		if (!parts) {
			return okAsync(null);
		}

		return this.source(parts.pluginId).map(
			(source) =>
				(source &&
					toFieldTypes(source.manifest, source.row === null).find((type) => type.id === id)) ??
				null
		);
	}

	/**
	 * Validates, then serializes values of the plugin's field types before they are saved; one
	 * result per item. Types without `validate` and `serialize` don't call the plugin.
	 */
	writeFieldValues(
		pluginId: string,
		items: FieldWriteItem[]
	): ResultAsync<FieldWriteResult[], ListFailed | FieldTypeNotInstalled | FieldCallFailed> {
		return this.fieldRuntime(pluginId, items, ['validate', 'serialize']).andThen((target) => {
			if (!target) {
				return okAsync(passThroughWrite(items));
			}

			return fromPromise(writeFieldValues(target.runtime, items, target.context), (error) =>
				this.fieldCallFailed(error)
			);
		});
	}

	/**
	 * Turns stored values of the plugin's field types into what the API returns; one array per item,
	 * in the same order. Types without `deserialize` don't call the plugin.
	 */
	readFieldValues(
		pluginId: string,
		items: FieldReadItem[]
	): ResultAsync<unknown[][], ListFailed | FieldTypeNotInstalled | FieldCallFailed> {
		return this.fieldRuntime(pluginId, items, ['deserialize']).andThen((target) => {
			if (!target) {
				return okAsync(items.map((item) => [...item.values] as unknown[]));
			}

			return fromPromise(
				readInChunks(items, (chunk) => readFieldValues(target.runtime, chunk, target.context)),
				(error) => this.fieldCallFailed(error)
			);
		});
	}

	/** The fields of collections that have one of the plugin's types, e.g. before removing it. */
	fieldUsage(pluginId: string): ResultAsync<PluginFieldUsage[], ListFailed> {
		return fromPromise(
			this.db
				.select({ collection: collections.name, field: fields.name, type: fields.type })
				.from(fields)
				.innerJoin(collections, eq(fields.collectionId, collections.id))
				.where(like(fields.type, `${pluginId}:%`))
				.orderBy(asc(collections.name), asc(fields.position), asc(fields.createdAt)),
			(error) => this.listFailed(error)
		).map((rows) =>
			rows
				.filter((row) => splitPluginFieldType(row.type)?.pluginId === pluginId)
				.map((row) => ({ collection: row.collection, field: row.field, type: String(row.type) }))
		);
	}

	/**
	 * The plugin's settings with their values (secrets masked); `null` when the plugin isn't
	 * there.
	 */
	settings(pluginId: string): ResultAsync<PluginSettingsState | null, ListFailed> {
		return this.source(pluginId).andThen((source) =>
			source
				? this.savedSettings([pluginId]).map((saved) =>
						settingsState(source.manifest.settings, saved.get(pluginId) ?? {})
					)
				: okAsync(null)
		);
	}

	/**
	 * Saves the plugin's settings: `undefined` keeps a value (an untouched secret), `null` or `''`
	 * clears it. Answers like `settings()`; `null` when the plugin isn't there.
	 */
	saveSettings(
		pluginId: string,
		values: Record<string, string | null | undefined>
	): ResultAsync<PluginSettingsState | null, ListFailed | InvalidSettings | SaveSettingsFailed> {
		return this.source(pluginId).andThen((source) => {
			if (!source) {
				return okAsync(null);
			}

			const definition = source.manifest.settings;

			return this.savedSettings([pluginId]).andThen((saved) => {
				const result = applySettings(definition, saved.get(pluginId) ?? {}, values);

				if (Object.keys(result.issues).length) {
					return errAsync({
						...this.error(19018, 'INVALID_PLUGIN_SETTINGS'),
						data: { issues: result.issues }
					});
				}

				const now = new Date();
				const rows = Object.entries(result.values).map(([key, value]) => ({
					pluginId,
					key,
					value,
					updatedAt: now
				}));

				return fromPromise(
					this.db.batch([
						this.db.delete(pluginSettings).where(eq(pluginSettings.pluginId, pluginId)),
						...chunks(rows, 20).map((chunk) => this.db.insert(pluginSettings).values(chunk))
					]),
					(error) => this.error(19019, 'SAVE_PLUGIN_SETTINGS_FAILED', error)
				).map(() => settingsState(definition, result.values));
			});
		});
	}

	/**
	 * An image of a plugin (`ui/*.svg`), e.g. a sign-in provider's logo; `null` when the plugin or
	 * the file doesn't exist.
	 */
	asset(pluginId: string, path: string): ResultAsync<PluginAsset | null, ListFailed> {
		if (!ASSET_PATH.test(path) || path.split('/').includes('..')) {
			return okAsync(null);
		}

		const asset = (content: string | undefined): PluginAsset | null =>
			typeof content === 'string' ? { content, contentType: 'image/svg+xml' } : null;

		return fromPromise(
			(async () => {
				const [row] = await this.db
					.select({ bundle: plugins.bundle })
					.from(plugins)
					.where(eq(plugins.id, pluginId));

				if (row) {
					const files = (JSON.parse(row.bundle) as { files?: Record<string, string> }).files ?? {};

					return asset(Object.hasOwn(files, path) ? files[path] : undefined);
				}

				const plugin = embeddedPlugin(pluginId);

				return plugin && Object.hasOwn(plugin.assets, path) ? asset(plugin.assets[path]) : null;
			})(),
			(error) => this.listFailed(error)
		);
	}

	private findRow(id: string): ResultAsync<PluginRow | null, ListFailed> {
		return fromPromise(this.db.select().from(plugins).where(eq(plugins.id, id)), (error) =>
			this.listFailed(error)
		).map(([row]) => row ?? null);
	}

	/** The plugin with this id: installed, or built in; `null` when neither. */
	private source(id: string): ResultAsync<PluginSource | null, ListFailed> {
		return fromPromise(
			this.db.select(INSTALLED_COLUMNS).from(plugins).where(eq(plugins.id, id)),
			(error) => this.listFailed(error)
		).map(([row]) => {
			if (row) {
				return { manifest: row.manifest, row };
			}

			const plugin = embeddedPlugin(id);

			return plugin ? { manifest: plugin.manifest, row: null } : null;
		});
	}

	/** Every installed plugin and the built-in ones they don't shadow. */
	private sources(): ResultAsync<PluginSource[], ListFailed> {
		return fromPromise(
			this.db.select(INSTALLED_COLUMNS).from(plugins).orderBy(asc(plugins.name)),
			(error) => this.listFailed(error)
		).map((rows) => {
			const ids = new Set(rows.map((row) => row.id));

			return [
				...rows.map((row) => ({ manifest: row.manifest, row })),
				...embeddedPlugins()
					.filter((plugin) => !ids.has(plugin.manifest.id))
					.map((plugin) => ({ manifest: plugin.manifest, row: null }))
			];
		});
	}

	/** Saved settings of the plugins with these ids. */
	private savedSettings(ids: string[]): ResultAsync<SavedSettings, ListFailed> {
		if (!ids.length) {
			return okAsync(new Map());
		}

		return fromPromise(
			this.db
				.select({
					pluginId: pluginSettings.pluginId,
					key: pluginSettings.key,
					value: pluginSettings.value
				})
				.from(pluginSettings)
				.where(inArray(pluginSettings.pluginId, ids)),
			(error) => this.listFailed(error)
		).map(groupSettings);
	}

	/** The runtime of a plugin, without settings bound; `null` without server code. */
	private runtimeOf(source: PluginSource): PluginRuntime | null {
		if (source.row) {
			return source.row.workerUrl && source.row.workerSecret
				? new WorkerRuntime(source.row.workerUrl, source.row.workerSecret)
				: null;
		}

		const plugin = embeddedPlugin(source.manifest.id);

		if (!plugin?.manifest.server) {
			return null;
		}

		// `event.fetch` handles requests to Pouchbase itself in this isolate, without the network,
		// with a key that only this isolate knows.
		const pouch = new Pouchbase(this.ctx.url.origin, {
			fetch: (input, init) => this.ctx.fetch(input, init),
			headers: { authorization: `Bearer ${internalKeyFor(plugin.manifest.id)}` }
		});

		return new InProcessRuntime(plugin, { pouch });
	}

	/**
	 * What the plugin's server code implements: stored on install, or asked of a built-in plugin
	 * (kept per build). `null` without server code, or for a plugin installed before it was stored.
	 * A built-in plugin that can't describe itself counts as one without capabilities.
	 */
	private async capabilities(
		source: PluginSource,
		saved: SavedSettings
	): Promise<DescribeResult | null> {
		if (source.row) {
			return source.row.capabilities ?? null;
		}

		const plugin = embeddedPlugin(source.manifest.id);

		if (!plugin?.manifest.server) {
			return null;
		}

		try {
			return await describeEmbedded(
				plugin,
				callContext(plugin.manifest, saved.get(plugin.manifest.id) ?? {})
			);
		} catch (error) {
			console.error(
				`[plugins] The built-in ${plugin.manifest.id} could not describe itself`,
				error
			);

			return null;
		}
	}

	/**
	 * Creates the collections the plugin contributes (`<plugin>_<name>`, owned by the plugin) and
	 * brings existing ones in line with the manifest. Fields and indexes the manifest leaves out
	 * stay, so an update never loses data; a change the schema API counts as destructive fails.
	 * Everything is checked before anything changes: a collection with one of the names that
	 * isn't the plugin's fails with `PLUGIN_COLLECTION_TAKEN`, an invalid one with
	 * `INVALID_PLUGIN_COLLECTION`.
	 */
	private applyCollections(
		manifest: PluginManifest
	): ResultAsync<void, CollectionTaken | InvalidCollection | CollectionsFailed> {
		const contributions = manifest.contributes.collections;

		if (!contributions.length) {
			return okAsync(undefined);
		}

		const service = this.services.collections();
		const failed = (error: unknown): CollectionsFailed =>
			this.error(19022, 'PLUGIN_COLLECTIONS_FAILED', error);
		const invalid = (issues: ManifestIssue[]): InvalidCollection => ({
			...this.error(19021, 'INVALID_PLUGIN_COLLECTION'),
			data: { issues }
		});
		const named = contributions.map((contribution) => ({
			contribution,
			name: pluginCollectionName(manifest.id, contribution.name)
		}));

		/** The collection as the schema API takes it, or its issues. */
		const input = (
			{ contribution, name }: (typeof named)[number],
			ids: ReadonlyMap<string, string>,
			current: SnapshotCollection | null
		) => {
			const result = collectionFields(manifest, contribution, ids, current);

			if ('issue' in result) {
				return { issues: [result.issue] };
			}

			const parsed = apiCreateCollectionSchema.safeParse({
				name,
				fields: result.fields,
				indexes: collectionIndexes(contribution, current),
				rules: contribution.rules
			});

			return parsed.success
				? { collection: parsed.data }
				: {
						issues: parsed.error.issues.map((issue) => ({
							path: `contributes.collections.${contribution.name}.${issue.path.join('.')}`,
							message: issue.message
						}))
					};
		};

		return service
			.list()
			.mapErr(failed)
			.andThen((existing) => {
				const byName = new Map(existing.map((collection) => [collection.name, collection]));
				const taken = named.find(({ name }) => {
					const collection = byName.get(name);

					return collection && collection.pluginId !== manifest.id;
				});

				if (taken) {
					return errAsync<never, CollectionTaken>({
						...this.error(19020, 'PLUGIN_COLLECTION_TAKEN'),
						data: { name: taken.name }
					});
				}

				// Checked with stand-in ids for the collections that don't exist yet.
				const planned = new Map(existing.map((collection) => [collection.name, collection.id]));

				for (const { name } of named) {
					if (!planned.has(name)) {
						planned.set(name, `new-${name}`);
					}
				}

				const issues = named.flatMap((item) => input(item, planned, null).issues ?? []);

				if (issues.length) {
					return errAsync(invalid(issues));
				}

				// Created without fields first, so relations between them find each other's ids.
				return inSequence(
					named
						.filter(({ name }) => !byName.has(name))
						.map(
							({ name }) =>
								() =>
									service
										.createFromApi({ name, fields: [], indexes: [], rules: {} })
										.mapErr(failed)
										.andThen(() =>
											fromPromise(
												this.db
													.update(collections)
													.set({ pluginId: manifest.id })
													.where(eq(collections.name, name)),
												failed
											)
										)
						)
				)
					.andThen(() => service.list().mapErr(failed))
					.andThen((all) => {
						const ids = new Map(all.map((collection) => [collection.name, collection.id]));

						return inSequence(
							named.map(
								(item) => () =>
									service
										.schema(item.name)
										.mapErr(failed)
										.andThen((current) => {
											const result = input(item, ids, current);

											if (!result.collection) {
												return errAsync(invalid(result.issues ?? []));
											}

											const { fields, indexes, rules } = result.collection;

											return service
												.updateFromApi(item.name, { fields, indexes, rules }, false)
												.mapErr(failed);
										})
							)
						);
					});
			});
	}

	private fieldCallFailed(error: unknown): FieldCallFailed {
		return { ...this.error(19017, 'FIELD_CALL_FAILED', error), data: { reason: reason(error) } };
	}

	/**
	 * What runs the field hooks of `items`, with the plugin's settings; `null` when none of their
	 * types has one of `hooks` (or the plugin has no server code), so the values pass as they are.
	 * Fails with `FIELD_TYPE_NOT_INSTALLED` when the plugin or one of the types isn't there.
	 */
	private fieldRuntime(
		pluginId: string,
		items: readonly { type: string }[],
		hooks: ('validate' | 'serialize' | 'deserialize')[]
	): ResultAsync<
		{ runtime: PluginRuntime; context: PluginCallContext } | null,
		ListFailed | FieldTypeNotInstalled
	> {
		const notInstalled = (type: string | null): FieldTypeNotInstalled => ({
			...this.error(19016, 'FIELD_TYPE_NOT_INSTALLED'),
			data: { pluginId, type }
		});

		return this.source(pluginId).andThen((source) => {
			if (!source) {
				return errAsync(notInstalled(items[0]?.type ?? null));
			}

			const known = new Set(source.manifest.contributes.fields.map((field) => field.type));
			const unknown = items.find((item) => !known.has(item.type));

			if (unknown) {
				return errAsync(notInstalled(unknown.type));
			}

			const runtime = this.runtimeOf(source);

			if (!items.length || !runtime) {
				return okAsync(null);
			}

			return this.savedSettings([pluginId]).andThen((saved) =>
				fromPromise(this.capabilities(source, saved), (error) => this.listFailed(error)).map(
					(capabilities) =>
						hasHooks(
							capabilities?.fieldHandlers,
							items.map((item) => item.type),
							hooks
						)
							? { runtime, context: callContext(source.manifest, saved.get(pluginId) ?? {}) }
							: null
				)
			);
		});
	}

	/** Compiles the UI files of a bundle; fails with the issues when one doesn't compile. */
	private compile(files: Record<string, string>): ResultAsync<CompiledUi, UiCompileFailed> {
		const failed = (issues: CompileIssue[], error?: unknown): UiCompileFailed => ({
			...this.error(19014, 'UI_COMPILE_FAILED', error ?? issues.map(formatCompileIssue).join('\n')),
			data: { issues }
		});

		return fromPromise(compileUi(files), (error) =>
			failed([{ path: UI_DIR, message: reason(error) }], error)
		).andThen((ui) => (ui.issues.length ? errAsync(failed(ui.issues)) : okAsync(ui)));
	}

	/**
	 * Compiles the UI of an installed plugin from its stored bundle and stores the modules; for
	 * plugins installed before the UI was compiled on install. Throws when it doesn't compile.
	 */
	private async compileStored(
		manifest: PluginManifest
	): Promise<{ path: string; code: string; imports: string[] }[]> {
		const [stored] = await this.db
			.select({ bundle: plugins.bundle })
			.from(plugins)
			.where(eq(plugins.id, manifest.id));
		const files =
			(JSON.parse(stored?.bundle ?? '{}') as { files?: Record<string, string> }).files ?? {};

		if (
			!Object.keys(files).some((path) => path.startsWith(`${UI_DIR}/`) && UI_MODULE_FILE.test(path))
		) {
			return [];
		}

		const ui = await compileUi(files);

		if (ui.issues.length) {
			throw new Error(ui.issues.map(formatCompileIssue).join('\n'));
		}

		const rows = moduleRows(manifest, ui, new Date());

		if (rows.length) {
			await this.db.batch([
				this.db.delete(pluginModules).where(eq(pluginModules.pluginId, manifest.id)),
				...chunks(rows, MODULE_ROWS_PER_INSERT).map((chunk) =>
					this.db.insert(pluginModules).values(chunk)
				)
			]);
		}

		return rows.map((row) => ({ path: row.path, code: row.code, imports: row.imports }));
	}

	/**
	 * Provider ids are global: one that another plugin (installed, or built in and not shadowed)
	 * contributes can't be taken.
	 */
	private checkProviderIds(
		manifest: PluginManifest
	): ResultAsync<void, ListFailed | ProviderTaken> {
		const ids = manifest.contributes.authProviders.map((provider) => provider.id);

		if (!ids.length) {
			return okAsync(undefined);
		}

		return fromPromise(
			this.db.batch([
				this.db.select({ id: plugins.id }).from(plugins),
				this.db
					.select({
						provider: pluginAuthProviders.provider,
						pluginId: pluginAuthProviders.pluginId
					})
					.from(pluginAuthProviders)
					.where(inArray(pluginAuthProviders.provider, ids))
			]),
			(error) => this.listFailed(error)
		).andThen(([installedRows, rows]) => {
			const installed = new Set(installedRows.map((row) => row.id));
			const holders = [
				...rows,
				...embeddedPlugins()
					.filter((plugin) => !installed.has(plugin.manifest.id))
					.flatMap((plugin) =>
						plugin.manifest.contributes.authProviders.map((provider) => ({
							provider: provider.id,
							pluginId: plugin.manifest.id
						}))
					)
			];
			const taken = holders.find(
				(holder) => ids.includes(holder.provider) && holder.pluginId !== manifest.id
			);

			return taken
				? errAsync({ ...this.error(19008, 'PROVIDER_ID_TAKEN'), data: taken })
				: okAsync(undefined);
		});
	}

	/**
	 * Deploys the server code to the plugin's Worker and asks it what it implements, with the
	 * plugin's settings. A plugin without server code gets no Worker (and loses the one of a
	 * previous version).
	 */
	private runServer(
		manifest: PluginManifest,
		server: string | null,
		existing: PluginRow | null,
		context: PluginCallContext
	): ResultAsync<
		{
			worker: { url: string; secret: string } | null;
			configs: Map<string, ProviderConfig>;
			description: DescribeResult | null;
		},
		DeployFailed | NoSubdomain | CallFailed
	> {
		const script = pluginScriptName(POUCHBASE_INSTANCE, manifest.id);
		const deployFailed = (error: unknown): DeployFailed => ({
			...this.error(19007, 'PLUGIN_DEPLOY_FAILED', error),
			data: { reason: reason(error) }
		});

		if (!server) {
			if (existing?.workerUrl) {
				this.deleteWorkerLater(script, manifest.id);
			}

			return this.services
				.apiKeys()
				.deletePluginKeys(manifest.id)
				.orElse((error) => {
					console.error(`[plugins] Could not remove the API keys of ${manifest.id}`, error);

					return okAsync(undefined);
				})
				.map(() => ({
					worker: null,
					configs: new Map<string, ProviderConfig>(),
					description: null
				}));
		}

		const secret = existing?.workerSecret ?? generateToken();

		return fromPromise(driver.subdomain(), deployFailed)
			.andThen((subdomain) =>
				subdomain ? okAsync(subdomain) : errAsync(this.error(19011, 'NO_WORKERS_SUBDOMAIN'))
			)
			.andThen((subdomain) =>
				this.services
					.apiKeys()
					.issuePluginKey(manifest.id)
					.mapErr(deployFailed)
					.map((apiKey) => ({ subdomain, apiKey }))
			)
			.andThen(({ subdomain, apiKey }) =>
				fromPromise(
					(async () => {
						await driver.deploy(script, {
							mainModule: ENTRY_MODULE,
							modules: workerModules(manifest, server),
							bindings: [
								{ type: 'secret_text', name: 'POUCHBASE_PLUGIN_SECRET', text: secret },
								{ type: 'plain_text', name: 'POUCHBASE_URL', text: this.ctx.url.origin },
								{ type: 'secret_text', name: 'POUCHBASE_API_KEY', text: apiKey.key }
							],
							message: `${manifest.id}@${manifest.version}`
						});

						if (!existing?.workerUrl) {
							await driver.enableSubdomain(script);
						}

						return { url: `https://${script}.${subdomain}.workers.dev`, secret };
					})(),
					deployFailed
				)
					// The key of a Worker that didn't deploy is of no use.
					.orElse((error) =>
						this.services
							.apiKeys()
							.deleteFunctionKey(apiKey.id)
							.orElse(() => okAsync(undefined))
							.andThen(() => errAsync(error))
					)
					// The Worker that runs now has the new key, so the older keys stop working.
					.andThen((worker) =>
						this.services
							.apiKeys()
							.keepPluginKey(manifest.id, apiKey.id)
							.orElse((error) => {
								console.error(`[plugins] Could not remove old API keys of ${manifest.id}`, error);

								return okAsync(undefined);
							})
							.map(() => worker)
					)
			)
			.andThen((worker) =>
				fromPromise(
					this.describeWorker(new WorkerRuntime(worker.url, worker.secret), context),
					(error) => this.callFailed(error)
				)
					.andThen((description) => {
						const result = providerConfigs(manifest, description.authProviders);

						if ('missing' in result) {
							return errAsync(
								this.callFailed(
									new PluginCallError(`The server code has no auth provider ${result.missing}`)
								)
							);
						}

						return okAsync({ worker, configs: result.configs, description });
					})
					.orElse((failure) => {
						// A new Worker that doesn't work is of no use; an updated one keeps its row.
						if (!existing?.workerUrl) {
							this.deleteWorkerLater(script, manifest.id);
						}

						return errAsync(failure);
					})
			);
	}

	private deleteWorkerLater(script: string, pluginId: string) {
		background(
			driver.delete(script).catch((error: unknown) => {
				console.error(`[plugins] Could not delete the Worker of ${pluginId}`, error);
			})
		);
	}

	/** `describe`, tried again while workers.dev doesn't serve a new Worker yet. */
	private async describeWorker(runtime: WorkerRuntime, context: PluginCallContext) {
		for (let attempt = 1; ; attempt++) {
			try {
				return await describePlugin(runtime, context);
			} catch (error) {
				if (
					!(error instanceof PluginCallError) ||
					!error.retryable ||
					attempt >= DESCRIBE_ATTEMPTS
				) {
					throw error;
				}

				await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
			}
		}
	}
}
