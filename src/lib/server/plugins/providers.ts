import type { AuthProviderContribution, PluginManifest } from '@pouchbasejs/plugin-sdk';
import type { BatchItem } from 'drizzle-orm/batch';
import type { EmbeddedPlugin } from './embedded';
import type { ProviderConfig } from './protocol';
import type { SavedSettings } from './sources';

import { inArray } from 'drizzle-orm';

import { db, pluginAuthProviders, plugins } from '../db';
import { embeddedPlugins } from './embedded';
import { fail } from './errors';
import { describeEmbedded } from './in-process';
import { callContext } from './sources';

/**
 * The sign-in providers plugins contribute, as rows of `plugin_auth_providers`: the manifest says
 * which exist (`contributes.authProviders`), the plugin's `describe` says how to run them
 * (`ProviderConfig`). Installed plugins write their rows on install; the built-in plugins are
 * brought in line by `PluginsService.ensureEmbedded()` with the helpers here.
 */

export type ProviderRow = typeof pluginAuthProviders.$inferInsert;

export function providerRow(
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
export function providerConfigs(
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

/**
 * The rows the built-in plugins `active` (those no installed plugin shadows) should have, from
 * what each reports. A provider id an installed plugin took before this build shipped it stays
 * with that plugin; a built-in plugin without a handler for one of its providers is logged.
 */
export async function desiredEmbeddedProviders(
	active: readonly EmbeddedPlugin[],
	installed: ReadonlySet<string>,
	rows: readonly ProviderRow[],
	saved: SavedSettings,
	now: Date
): Promise<ProviderRow[]> {
	const desired: ProviderRow[] = [];

	for (const plugin of active) {
		const { manifest } = plugin;
		const description = await describeEmbedded(
			plugin,
			callContext(manifest, saved.get(manifest.id) ?? {})
		);

		for (const contribution of manifest.contributes.authProviders) {
			const config = description.authProviders[contribution.id];
			const holder = rows.find((row) => row.provider === contribution.id);

			if (!config) {
				console.error(
					`[plugins] The built-in ${manifest.id} has no handler for ${contribution.id}`
				);
				continue;
			}

			if (holder && holder.pluginId !== manifest.id && installed.has(holder.pluginId)) {
				console.warn(
					`[plugins] ${contribution.id} belongs to ${holder.pluginId}; skipping the built-in ${manifest.id}`
				);
				continue;
			}

			desired.push(providerRow(manifest.id, contribution, config, now));
		}
	}

	return desired;
}

/**
 * The statements that bring `plugin_auth_providers` from `rows` to `desired` for the built-in
 * plugins (`activeIds`): rows of plugins that are neither installed nor built in go, and so do
 * rows of built-in plugins that no longer have the provider; rows that changed are written.
 */
export function providerStatements(
	database: typeof db,
	rows: readonly ProviderRow[],
	desired: readonly ProviderRow[],
	installed: ReadonlySet<string>,
	activeIds: ReadonlySet<string>
): BatchItem<'sqlite'>[] {
	const stale = rows.filter(
		(row) =>
			(!installed.has(row.pluginId) && !activeIds.has(row.pluginId)) ||
			(activeIds.has(row.pluginId) && !desired.some((item) => item.provider === row.provider))
	);
	const changed = desired.filter((item) => {
		const row = rows.find((existing) => existing.provider === item.provider);

		return !row || !sameProvider(row, item);
	});

	return [
		...(stale.length
			? [
					database.delete(pluginAuthProviders).where(
						inArray(
							pluginAuthProviders.provider,
							stale.map((row) => row.provider)
						)
					)
				]
			: []),
		...changed.map((item) =>
			database
				.insert(pluginAuthProviders)
				.values(item)
				.onConflictDoUpdate({ target: pluginAuthProviders.provider, set: item })
		)
	];
}

/**
 * Provider ids are global: one that another plugin (installed, or built in and not shadowed)
 * contributes can't be taken. Fails with `PROVIDER_ID_TAKEN`.
 */
export async function checkProviderIds(manifest: PluginManifest) {
	const ids = manifest.contributes.authProviders.map((provider) => provider.id);

	if (!ids.length) {
		return;
	}

	const [installedRows, rows] = await db.batch([
		db.select({ id: plugins.id }).from(plugins),
		db
			.select({ provider: pluginAuthProviders.provider, pluginId: pluginAuthProviders.pluginId })
			.from(pluginAuthProviders)
			.where(inArray(pluginAuthProviders.provider, ids))
	]);
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

	if (taken) {
		fail({ code: 19008, message: 'PROVIDER_ID_TAKEN', data: taken });
	}
}
