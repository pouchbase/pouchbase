import type { PluginDetails, PluginList } from '@pouchbasejs/plugin-sdk';
import type { PluginUser } from '@pouchbasejs/plugin-sdk/server';
import type { ResultAsync } from 'neverthrow';
import type { PluginsError, RegistryError } from '../plugins/errors';
import type { PluginModules } from '../plugins/modules';
import type { PluginGrant } from '../plugins/grant';
import type {
	FieldReadItem,
	FieldWriteItem,
	FieldWriteResult,
	PluginCallContext,
	PluginRuntime
} from '../plugins/protocol';
import type { PluginSettingsState } from '../plugins/settings';
import type {
	InstalledPlugin,
	PluginFieldType,
	PluginPage,
	PluginRow,
	PluginSource,
	SavedSettings
} from '../plugins/sources';

import { SUPPORTED_API_VERSIONS, splitPluginFieldType } from '@pouchbasejs/plugin-sdk';
import { and, asc, eq, inArray, like } from 'drizzle-orm';

import { POUCHBASE_INSTANCE } from '$app/env/private';

import {
	collections,
	fields,
	pluginAuthProviders,
	pluginModules,
	pluginSettings,
	plugins
} from '../db';
import { functions as driver } from '../platform';
import { applyCollections, deleteCollections } from '../plugins/apply-collections';
import { embeddedPlugin, embeddedPlugins } from '../plugins/embedded';
import { causeOf } from '../plugins/errors';
import { hasHooks, passThroughWrite, readInChunks } from '../plugins/field-values';
import {
	fetchBundle,
	registryClient,
	registryFailure,
	removeInstalled,
	runServer,
	storeInstalled
} from '../plugins/install';
import { chunks, compileBundle, toModules } from '../plugins/modules';
import { readFieldValues, withCallContext, writeFieldValues } from '../plugins/protocol';
import {
	checkProviderIds,
	desiredEmbeddedProviders,
	providerStatements
} from '../plugins/providers';
import { matchPage } from '../plugins/requests';
import { PluginRuntimes, storedFiles } from '../plugins/runtimes';
import { applySettings, settingsState } from '../plugins/settings';
import {
	callContext,
	groupSettings,
	imageUrl,
	INSTALLED_COLUMNS,
	toFieldTypes,
	toInstalled
} from '../plugins/sources';
import { pluginScriptName } from '../plugins/worker';
import { Service } from './base.service';

export type { PluginsError } from '../plugins/errors';
export type { PluginModules } from '../plugins/modules';
export type { InstalledPlugin, PluginFieldType, PluginPage } from '../plugins/sources';

/**
 * Plugins: those installed from a plugin registry (the public one on pouchbase.io, or
 * `POUCHBASE_REGISTRY_URL`) and the built-in ones from `plugins/*` (`../plugins/embedded.ts`). The
 * registry API, the manifest and the bundle format come from `@pouchbasejs/plugin-sdk`.
 *
 * Installing downloads the bundle and checks it (`../plugins/install.ts`), compiles its UI for the
 * dashboard (`../plugins/modules.ts`, stored in `plugin_modules`), creates its collections
 * (`../plugins/apply-collections.ts`), deploys its server code to a Worker of its own
 * (`../plugins/worker.ts`), stores what `describe` reports (`plugins.capabilities`) and registers
 * the sign-in providers it contributes in `plugin_auth_providers` (`../plugins/providers.ts`).
 * Built-in plugins run inside Pouchbase and register their providers through `ensureEmbedded()`;
 * their UI is compiled by Vite with the dashboard. Installing a plugin with the same id from the
 * registry shadows the built-in one.
 *
 * A plugin's routes answer at `/api/plugins/<id>/<path>` (`route()`), its pages open at
 * `/plugins/<id>/<path>` (`page()`), its field types run through `writeFieldValues()` and
 * `readFieldValues()`, and its settings (`plugin_settings`) reach every call as `ctx.settings`.
 */

/** Results per page when searching the registry. */
const PER_PAGE = 24;

/** Built-in plugins whose collections this isolate brought in line, as `<id>@<version>`. */
const appliedEmbedded = new Set<string>();

/** Logos and other images in `ui/`; the only plugin files served to browsers. */
const ASSET_PATH = /^ui\/(?:[\w-]+\/)*[\w.-]+\.svg$/;

/** The page `/plugins/<plugin>/<path>` opens. */
export type PluginPageMatch = {
	plugin: InstalledPlugin;
	page: PluginPage & { component: string };
	/** The rest of the path below the page, e.g. `2026/10`; empty for the page itself. */
	params: string;
};

/** A field of a collection that has a plugin's field type. */
export type PluginFieldUsage = { collection: string; field: string; type: string };

/** A file of a plugin served to browsers, e.g. a sign-in provider's logo. */
export type PluginAsset = { content: string; contentType: string };

export class PluginsService extends Service {
	private readonly registry = registryClient();

	private readonly runtimes = new PluginRuntimes(this.ctx.url.origin, (input, init) =>
		this.ctx.fetch(input, init)
	);

	private readonly failed = (error: unknown) => this.error(19001, 'PLUGINS_FAILED', error);

	/** Plugins in the registry that this Pouchbase can run, matching `query` (and `category`). */
	search(query: string, page = 1, category?: string): ResultAsync<PluginList, RegistryError> {
		return this.run(
			() =>
				this.registry.search({
					query,
					category,
					page,
					perPage: PER_PAGE,
					apiVersions: SUPPORTED_API_VERSIONS
				}),
			registryFailure
		);
	}

	/** A plugin with its versions and readme; `null` when the registry doesn't have it. */
	details(id: string): ResultAsync<PluginDetails | null, RegistryError> {
		return this.run(() => this.registry.get(id), registryFailure);
	}

	/** Installed plugins and the built-in ones they don't shadow, by name. */
	installed(): ResultAsync<InstalledPlugin[], PluginsError> {
		return this.run(async () => {
			await this.syncEmbedded();

			const sources = await this.sources();
			const saved = await this.savedSettings(sources.map((source) => source.manifest.id));
			const list = await Promise.all(
				sources.map(async (source) =>
					toInstalled(
						source,
						saved.get(source.manifest.id) ?? {},
						(await this.runtimes.capabilities(source, saved))?.routes ?? []
					)
				)
			);

			return list.sort((a, b) => a.name.localeCompare(b.name));
		}, this.failed);
	}

	/**
	 * Installs the newest version of a plugin that this Pouchbase can run (or the `requested` one), or
	 * updates an installed plugin to it. The UI is compiled and the collections are created before
	 * the Worker is deployed, so a plugin whose components don't compile changes nothing, and its
	 * first call finds its collections.
	 */
	install(
		id: string,
		/** A publish installs the version the development instance has. */
		requested = 'latest'
	): ResultAsync<InstalledPlugin, PluginsError> {
		return this.run(async () => {
			const { version, bytes, manifest, files, server } = await fetchBundle(
				this.registry,
				id,
				requested
			);

			await checkProviderIds(manifest);

			const existing = await this.findRow(manifest.id);
			const ui = await compileBundle(files);

			await applyCollections(this.services, manifest);

			const saved = (await this.savedSettings([id])).get(id) ?? {};
			const { worker, configs, description } = await runServer(
				this.services,
				this.runtimes,
				manifest,
				server,
				existing,
				callContext(manifest, saved)
			);
			const row = await storeInstalled({
				manifest,
				integrity: version.integrity,
				bytes,
				ui,
				worker,
				description,
				configs
			});

			return toInstalled({ manifest, row }, saved, description?.routes ?? []);
		}, this.failed);
	}

	/**
	 * Removes an installed plugin with its collections and their records, its Worker, its API key,
	 * sign-in providers, compiled UI and settings; `null` when it isn't installed. Fails with
	 * `PLUGIN_COLLECTION_IN_USE`, changing nothing, while a relation field of another collection
	 * points to one of its collections. A built-in plugin can't be removed; removing a plugin that
	 * shadowed one brings the built-in plugin back, with collections of its own. Fields with the
	 * plugin's types in other collections keep their data.
	 */
	uninstall(id: string): ResultAsync<{ id: string } | null, PluginsError> {
		return this.run(async () => {
			const row = await this.findRow(id);

			if (!row) {
				return embeddedPlugin(id) ? this.fail(19010, 'PLUGIN_BUILT_IN') : null;
			}

			// The collections go first: while one can't, the plugin stays installed and keeps working.
			await deleteCollections(this.services, id);

			if (row.workerUrl !== null) {
				await driver.delete(pluginScriptName(POUCHBASE_INSTANCE, id));
			}

			await removeInstalled(id);

			if (embeddedPlugin(id)) {
				// The built-in plugin sets up its collections again, which went with the installed one.
				for (const key of appliedEmbedded) {
					if (key.startsWith(`${id}@`)) {
						appliedEmbedded.delete(key);
					}
				}

				await this.syncEmbedded();
			}

			return { id };
		}, this.failed);
	}

	/** The names of the plugin's collections (those with its `plugin_id`), sorted. */
	ownCollections(pluginId: string): ResultAsync<string[], PluginsError> {
		return this.run(async () => {
			const rows = await this.db
				.select({ name: collections.name })
				.from(collections)
				.where(eq(collections.pluginId, pluginId))
				.orderBy(asc(collections.name));

			return rows.map((row) => row.name);
		}, this.failed);
	}

	/**
	 * Brings `plugin_auth_providers` in line with the built-in plugins of this build: registers the
	 * providers of every built-in plugin that no installed plugin shadows, and removes rows of
	 * plugins that are neither installed nor built in. Writes only when something changed, so it is
	 * cheap to call before reading the providers.
	 */
	ensureEmbedded(): ResultAsync<void, PluginsError> {
		return this.run(async () => {
			const [installedRows, rows, settingRows] = await this.db.batch([
				this.db.select({ id: plugins.id }).from(plugins),
				this.db.select().from(pluginAuthProviders),
				this.db.select().from(pluginSettings)
			]);
			const installed = new Set(installedRows.map((row) => row.id));
			const active = embeddedPlugins().filter((plugin) => !installed.has(plugin.manifest.id));
			const desired = await desiredEmbeddedProviders(
				active,
				installed,
				rows,
				groupSettings(settingRows),
				new Date()
			);
			const statements = providerStatements(
				this.db,
				rows,
				desired,
				installed,
				new Set(active.map((plugin) => plugin.manifest.id))
			);

			if (statements.length) {
				await this.db.batch(statements as [(typeof statements)[number], ...typeof statements]);
			}

			// Once per version and isolate: a plugin's collections change only with the plugin.
			for (const { manifest } of active) {
				const key = `${manifest.id}@${manifest.version}`;

				if (!manifest.contributes.collections.length || appliedEmbedded.has(key)) {
					continue;
				}

				try {
					await applyCollections(this.services, manifest);
					appliedEmbedded.add(key);
				} catch (error) {
					console.error(
						`[plugins] Could not set up the collections of the built-in ${manifest.id}`,
						error
					);
				}
			}
		}, this.failed);
	}

	/**
	 * What the plugin may do through the records API (`ctx.pouch`): read and write the collections
	 * of its `permissions.collections`, and its own collections (those with its `plugin_id`). `null`
	 * when the plugin isn't there.
	 */
	grant(pluginId: string): ResultAsync<PluginGrant | null, PluginsError> {
		return this.run(async () => {
			const source = await this.source(pluginId);

			if (!source) {
				return null;
			}

			const rows = await this.db
				.select({ name: collections.name })
				.from(collections)
				.where(eq(collections.pluginId, pluginId));
			const own = rows.map((row) => row.name);
			const { read, write } = source.manifest.permissions.collections;
			const names = (list: string[]): PluginGrant['read'] =>
				list.includes('*') ? '*' : new Set([...list, ...own]);

			return { pluginId, read: names(read), write: names(write) };
		}, this.failed);
	}

	/**
	 * What runs the plugin's server code: its Worker when installed, Pouchbase itself when built in.
	 * Calls that don't pass a context of their own get the plugin's settings. `null` when the plugin
	 * isn't there or has no server code.
	 */
	runtimeFor(pluginId: string): ResultAsync<PluginRuntime | null, PluginsError> {
		return this.run(async () => {
			const source = await this.source(pluginId);
			const runtime = source ? this.runtimes.of(source) : null;

			if (!source || !runtime) {
				return null;
			}

			const saved = await this.savedSettings([pluginId]);

			return withCallContext(runtime, callContext(source.manifest, saved.get(pluginId) ?? {}));
		}, this.failed);
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
	): ResultAsync<Response | null, PluginsError> {
		return this.run(async () => {
			const source = await this.source(pluginId);
			const runtime = source ? this.runtimes.of(source) : null;

			if (!source || !runtime) {
				return null;
			}

			const saved = await this.savedSettings([pluginId]);

			try {
				return await runtime.route(
					request,
					{ path: path.startsWith('/') ? path : `/${path}`, search: new URL(request.url).search },
					{ ...callContext(source.manifest, saved.get(pluginId) ?? {}), ...caller }
				);
			} catch (error) {
				return this.fail(19013, 'PLUGIN_ROUTE_FAILED', {
					data: { reason: causeOf(error) },
					cause: error
				});
			}
		}, this.failed);
	}

	/**
	 * The compiled UI of an installed plugin; `null` when it isn't installed or is built in (the
	 * dashboard has the components of built-in plugins already).
	 */
	modules(pluginId: string): ResultAsync<PluginModules | null, PluginsError> {
		return this.run(async () => {
			const [row] = await this.db
				.select(INSTALLED_COLUMNS)
				.from(plugins)
				.where(eq(plugins.id, pluginId));

			if (!row) {
				return null;
			}

			const rows = await this.db
				.select({
					path: pluginModules.path,
					code: pluginModules.code,
					imports: pluginModules.imports
				})
				.from(pluginModules)
				.where(and(eq(pluginModules.pluginId, pluginId), eq(pluginModules.version, row.version)));

			return toModules(row.version, rows);
		}, this.failed);
	}

	/**
	 * The page that `/plugins/<pluginId>/<path>` opens: the plugin's page with the longest path that
	 * `path` starts with, and the rest of `path` as `params`. `null` when there is none.
	 */
	page(pluginId: string, path: string): ResultAsync<PluginPageMatch | null, PluginsError> {
		return this.run(async () => {
			const source = await this.source(pluginId);
			const match = source ? matchPage(source.manifest.contributes.pages, path) : null;

			if (!source || !match) {
				return null;
			}

			const saved = await this.savedSettings([pluginId]);
			const capabilities = await this.runtimes.capabilities(source, saved);

			return {
				plugin: toInstalled(source, saved.get(pluginId) ?? {}, capabilities?.routes ?? []),
				page: {
					path: match.page.path,
					title: match.page.title,
					component: match.page.component,
					navigation: match.page.navigation,
					layout: match.page.layout ?? 'default',
					iconUrl: imageUrl(source.manifest, match.page.icon)
				},
				params: match.params
			};
		}, this.failed);
	}

	/** The field types of the installed and built-in plugins, by plugin and then in manifest order. */
	fieldTypes(): ResultAsync<PluginFieldType[], PluginsError> {
		return this.run(
			async () =>
				(await this.sources())
					.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
					.flatMap(toFieldTypes),
			this.failed
		);
	}

	/** A plugin's field type by its id (`<plugin>:<type>`); `null` when no plugin there has it. */
	fieldType(id: string): ResultAsync<PluginFieldType | null, PluginsError> {
		return this.run(async () => {
			const parts = splitPluginFieldType(id);
			const source = parts ? await this.source(parts.pluginId) : null;

			return (source && toFieldTypes(source).find((type) => type.id === id)) ?? null;
		}, this.failed);
	}

	/**
	 * Validates, then serializes values of the plugin's field types before they are saved; one
	 * result per item. Types without `validate` and `serialize` don't call the plugin.
	 */
	writeFieldValues(
		pluginId: string,
		items: FieldWriteItem[]
	): ResultAsync<FieldWriteResult[], PluginsError> {
		return this.run(async () => {
			const target = await this.fieldRuntime(pluginId, items, ['validate', 'serialize']);

			if (!target) {
				return passThroughWrite(items);
			}

			return this.fieldCall(() => writeFieldValues(target.runtime, items, target.context));
		}, this.failed);
	}

	/**
	 * Turns stored values of the plugin's field types into what the API returns; one array per item,
	 * in the same order. Types without `deserialize` don't call the plugin.
	 */
	readFieldValues(
		pluginId: string,
		items: FieldReadItem[]
	): ResultAsync<unknown[][], PluginsError> {
		return this.run(async () => {
			const target = await this.fieldRuntime(pluginId, items, ['deserialize']);

			if (!target) {
				return items.map((item) => [...item.values] as unknown[]);
			}

			return this.fieldCall(() =>
				readInChunks(items, (chunk) => readFieldValues(target.runtime, chunk, target.context))
			);
		}, this.failed);
	}

	/** The fields of collections that have one of the plugin's types, e.g. before removing it. */
	fieldUsage(pluginId: string): ResultAsync<PluginFieldUsage[], PluginsError> {
		return this.run(async () => {
			const rows = await this.db
				.select({ collection: collections.name, field: fields.name, type: fields.type })
				.from(fields)
				.innerJoin(collections, eq(fields.collectionId, collections.id))
				.where(like(fields.type, `${pluginId}:%`))
				.orderBy(asc(collections.name), asc(fields.position), asc(fields.createdAt));

			return rows
				.filter((row) => splitPluginFieldType(row.type)?.pluginId === pluginId)
				.map((row) => ({ collection: row.collection, field: row.field, type: String(row.type) }));
		}, this.failed);
	}

	/** The plugin's settings with their values (secrets masked); `null` when the plugin isn't there. */
	settings(pluginId: string): ResultAsync<PluginSettingsState | null, PluginsError> {
		return this.run(async () => {
			const source = await this.source(pluginId);

			if (!source) {
				return null;
			}

			const saved = await this.savedSettings([pluginId]);

			return settingsState(source.manifest.settings, saved.get(pluginId) ?? {});
		}, this.failed);
	}

	/**
	 * Saves the plugin's settings: `undefined` keeps a value (an untouched secret), `null` or `''`
	 * clears it. Answers like `settings()`; `null` when the plugin isn't there.
	 */
	saveSettings(
		pluginId: string,
		values: Record<string, string | null | undefined>
	): ResultAsync<PluginSettingsState | null, PluginsError> {
		return this.run(async () => {
			const source = await this.source(pluginId);

			if (!source) {
				return null;
			}

			const definition = source.manifest.settings;
			const saved = await this.savedSettings([pluginId]);
			const result = applySettings(definition, saved.get(pluginId) ?? {}, values);

			if (Object.keys(result.issues).length) {
				this.fail(19018, 'INVALID_PLUGIN_SETTINGS', { data: { issues: result.issues } });
			}

			const now = new Date();
			const rows = Object.entries(result.values).map(([key, value]) => ({
				pluginId,
				key,
				value,
				updatedAt: now
			}));

			await this.db.batch([
				this.db.delete(pluginSettings).where(eq(pluginSettings.pluginId, pluginId)),
				...chunks(rows, 20).map((chunk) => this.db.insert(pluginSettings).values(chunk))
			]);

			return settingsState(definition, result.values);
		}, this.failed);
	}

	/**
	 * An image of a plugin (`ui/*.svg`), e.g. a sign-in provider's logo; `null` when the plugin or
	 * the file doesn't exist.
	 */
	asset(pluginId: string, path: string): ResultAsync<PluginAsset | null, PluginsError> {
		return this.run(async () => {
			if (!ASSET_PATH.test(path) || path.split('/').includes('..')) {
				return null;
			}

			const files = (await storedFiles(pluginId)) ?? embeddedPlugin(pluginId)?.assets;
			const content = files && Object.hasOwn(files, path) ? files[path] : undefined;

			return typeof content === 'string' ? { content, contentType: 'image/svg+xml' } : null;
		}, this.failed);
	}

	/** `ensureEmbedded`, where a failure is logged and the providers registered before are used. */
	private async syncEmbedded() {
		const synced = await this.ensureEmbedded();

		if (synced.isErr()) {
			console.error('[plugins] Could not register the built-in plugins', synced.error);
		}
	}

	private async findRow(id: string): Promise<PluginRow | null> {
		const [row] = await this.db.select().from(plugins).where(eq(plugins.id, id));

		return row ?? null;
	}

	/** The plugin with this id: installed, or built in; `null` when neither. */
	private async source(id: string): Promise<PluginSource | null> {
		const [row] = await this.db.select(INSTALLED_COLUMNS).from(plugins).where(eq(plugins.id, id));

		if (row) {
			return { manifest: row.manifest, row };
		}

		const plugin = embeddedPlugin(id);

		return plugin ? { manifest: plugin.manifest, row: null } : null;
	}

	/** Every installed plugin and the built-in ones they don't shadow. */
	private async sources(): Promise<PluginSource[]> {
		const rows = await this.db.select(INSTALLED_COLUMNS).from(plugins).orderBy(asc(plugins.name));
		const ids = new Set(rows.map((row) => row.id));

		return [
			...rows.map((row) => ({ manifest: row.manifest, row })),
			...embeddedPlugins()
				.filter((plugin) => !ids.has(plugin.manifest.id))
				.map((plugin) => ({ manifest: plugin.manifest, row: null }))
		];
	}

	/** Saved settings of the plugins with these ids. */
	private async savedSettings(ids: string[]): Promise<SavedSettings> {
		if (!ids.length) {
			return new Map();
		}

		const rows = await this.db
			.select({
				pluginId: pluginSettings.pluginId,
				key: pluginSettings.key,
				value: pluginSettings.value
			})
			.from(pluginSettings)
			.where(inArray(pluginSettings.pluginId, ids));

		return groupSettings(rows);
	}

	/** A field hook call; fails with `FIELD_CALL_FAILED` when the plugin doesn't answer as expected. */
	private async fieldCall<T>(call: () => Promise<T>): Promise<T> {
		try {
			return await call();
		} catch (error) {
			return this.fail(19017, 'FIELD_CALL_FAILED', {
				data: { reason: causeOf(error) },
				cause: error
			});
		}
	}

	/**
	 * What runs the field hooks of `items`, with the plugin's settings; `null` when none of their
	 * types has one of `hooks` (or the plugin has no server code), so the values pass as they are.
	 * Fails with `FIELD_TYPE_NOT_INSTALLED` when the plugin or one of the types isn't there.
	 */
	private async fieldRuntime(
		pluginId: string,
		items: readonly { type: string }[],
		hooks: ('validate' | 'serialize' | 'deserialize')[]
	): Promise<{ runtime: PluginRuntime; context: PluginCallContext } | null> {
		const source = await this.source(pluginId);

		if (!source) {
			return this.fail(19016, 'FIELD_TYPE_NOT_INSTALLED', {
				data: { pluginId, type: items[0]?.type ?? null }
			});
		}

		const known = new Set(source.manifest.contributes.fields.map((field) => field.type));
		const unknown = items.find((item) => !known.has(item.type));

		if (unknown) {
			return this.fail(19016, 'FIELD_TYPE_NOT_INSTALLED', {
				data: { pluginId, type: unknown.type }
			});
		}

		const runtime = this.runtimes.of(source);

		if (!items.length || !runtime) {
			return null;
		}

		const saved = await this.savedSettings([pluginId]);
		const capabilities = await this.runtimes.capabilities(source, saved);
		const needed = hasHooks(
			capabilities?.fieldHandlers ?? {},
			items.map((item) => item.type),
			hooks
		);

		return needed
			? { runtime, context: callContext(source.manifest, saved.get(pluginId) ?? {}) }
			: null;
	}
}
