import type {
	ContributionSummary,
	PageLayout,
	PluginManifest,
	PluginPermissions
} from '@pouchbasejs/plugin-sdk';
import type { FieldColumn } from '@pouchbasejs/plugin-sdk/server';
import type { PluginFieldTypeId } from '#lib/fields/field-types.js';
import type { PluginCallContext } from './protocol';

import { contributionSummary, pluginFieldTypeId, resolveSettings } from '@pouchbasejs/plugin-sdk';
import { pluginImagePath } from '#lib/auth/oauth-providers.js';

import { plugins } from '../db';
import { embeddedPlugin } from './embedded';
import { missingSettings } from './settings';

/**
 * The plugins that are there, as `PluginsService` reads them: installed from the registry (a row
 * of `plugins`), or built in and not shadowed by an installed one; and what the dashboard gets of
 * them.
 */

/** Every column of `plugins` but the bundle, which can be a megabyte. */
export const INSTALLED_COLUMNS = {
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

export type PluginRow = typeof plugins.$inferSelect;

export type InstalledRow = Omit<PluginRow, 'bundle' | 'integrity'>;

/**
 * A plugin that is there: installed from the registry (`row`), or built in and not shadowed by an
 * installed one (`row` is `null`).
 */
export type PluginSource = { manifest: PluginManifest; row: InstalledRow | null };

/** Saved settings by plugin id. */
export type SavedSettings = Map<string, Record<string, string>>;

/** A page of a plugin in the dashboard, at `/plugins/<plugin>/<path>`. */
export type PluginPage = {
	path: string;
	title: string;
	/** Whether the sidebar links to it. */
	navigation: boolean;
	/** How much of the dashboard the page takes (`PAGE_LAYOUTS` of the plugin SDK). */
	layout: PageLayout;
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

/** The URL of an image of the plugin (its icon, or that of a contribution); `null` without. */
export function imageUrl(manifest: PluginManifest, path: string | undefined) {
	return path ? pluginImagePath(manifest.id, path, manifest.version) : null;
}

function pagesOf(manifest: PluginManifest): PluginPage[] {
	return manifest.contributes.pages.map(({ path, title, navigation, layout, icon }) => ({
		path,
		title,
		navigation,
		layout: layout ?? 'default',
		iconUrl: imageUrl(manifest, icon)
	}));
}

export function toInstalled(
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
		iconUrl: imageUrl(manifest, manifest.icon),
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

export function toFieldTypes(source: PluginSource): PluginFieldType[] {
	const { manifest } = source;

	return manifest.contributes.fields.map((field) => ({
		id: pluginFieldTypeId(manifest.id, field.type),
		pluginId: manifest.id,
		pluginName: manifest.name,
		pluginVersion: manifest.version,
		embedded: source.row === null,
		type: field.type,
		label: field.label,
		description: field.description || null,
		column: field.column,
		input: field.input,
		preview: field.preview ?? null,
		iconUrl: imageUrl(manifest, field.icon)
	}));
}

/** Saved settings rows grouped by plugin. */
export function groupSettings(
	rows: { pluginId: string; key: string; value: string }[]
): SavedSettings {
	const saved: SavedSettings = new Map();

	for (const row of rows) {
		const values = saved.get(row.pluginId) ?? {};

		values[row.key] = row.value;
		saved.set(row.pluginId, values);
	}

	return saved;
}

/** The context of a call into a plugin: its settings with their defaults. */
export function callContext(
	manifest: PluginManifest,
	saved: Readonly<Record<string, string>>
): PluginCallContext {
	return { settings: resolveSettings(manifest.settings, saved) };
}
