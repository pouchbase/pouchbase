import type { Where } from '@pouchbasejs/js-sdk';
import type {
	ContributionSummary,
	PluginDetails,
	PluginList,
	PluginSummary,
	PluginVersion
} from '@pouchbasejs/plugin-sdk';

import type { PluginRecord, PluginVersionRecord } from '../pouchbase';
import type { VersionRow } from './shared';

import { admin } from '../pouchbase';
import {
	backendFailure,
	bundleContributes,
	findPlugin,
	iso,
	listVersions,
	toVersion
} from './shared';

/** Reading the registry: searching plugins and getting a plugin, a version, a bundle or an icon. */

function toSummary(plugin: PluginRecord): PluginSummary {
	return {
		id: plugin.slug,
		name: plugin.name,
		description: plugin.description ?? '',
		version: plugin.version,
		apiVersion: plugin.api_version,
		author: plugin.author || null,
		iconUrl: plugin.icon_url || null,
		keywords: plugin.keywords ?? [],
		categories: plugin.categories ?? [],
		downloads: plugin.downloads ?? 0,
		verified: plugin.verified ?? false,
		updatedAt: iso(plugin.updated_at)
	};
}

/** Parts read per request: up to 1.5 MB each. */
const PARTS_PER_REQUEST = 8;

/** The bundle of version `id`: its first part with the ones in `plugin_bundle_parts`. */
async function readBundle(id: string, first: string): Promise<string> {
	const parts = await admin()
		.db.plugin_bundle_parts.findAll({
			where: { version: id },
			orderBy: { part: 'asc' },
			select: ['data'],
			batchSize: PARTS_PER_REQUEST
		})
		.catch(backendFailure);

	return first + parts.map((part) => part.data).join('');
}

/** The bundle of a stored version; `null` when there is none. */
async function storedBundle(where: Where<PluginVersionRecord>): Promise<string | null> {
	const row = await admin()
		.db.plugin_versions.findFirst({ where, select: ['id', 'bundle'] })
		.catch(backendFailure);

	return row ? readBundle(row.id, row.bundle) : null;
}

/** The `contributes` summary of a stored version; `undefined` when its bundle can't be read. */
async function versionContributes(row: VersionRow): Promise<ContributionSummary | undefined> {
	const bundle = await storedBundle({ id: row.id });

	return bundle === null ? undefined : bundleContributes(bundle);
}

export type SearchInput = {
	query?: string;
	/** Only plugins listed under this category. */
	category?: string;
	page: number;
	perPage: number;
	apiVersions: number[];
};

/** Plugins whose name, id or description contains the query, most downloaded first. */
export async function searchPlugins(input: SearchInput): Promise<PluginList> {
	const conditions: Where<PluginRecord>[] = [];

	if (input.query?.trim()) {
		const query = input.query.trim();

		conditions.push({
			$or: [
				{ name: { contains: query } },
				{ slug: { contains: query } },
				{ description: { contains: query } }
			]
		});
	}

	if (input.category) {
		conditions.push({ categories_text: { contains: `,${input.category},` } });
	}

	if (input.apiVersions.length) {
		conditions.push({
			$or: input.apiVersions.map((version) => ({ api_versions: { contains: `,${version},` } }))
		});
	}

	const result = await admin()
		.db.plugins.findMany({
			where: { $and: conditions },
			orderBy: { downloads: 'desc', name: 'asc' },
			limit: input.perPage,
			offset: (input.page - 1) * input.perPage
		})
		.catch(backendFailure);

	return {
		items: result.items.map(toSummary),
		page: input.page,
		perPage: input.perPage,
		total: result.total
	};
}

/**
 * A plugin with every version, newest first; `null` when there is none. Only the newest version
 * (the one the dashboard's install dialog shows) has `contributes`, so the list doesn't read every
 * bundle.
 */
export async function getPlugin(origin: string, slug: string): Promise<PluginDetails | null> {
	const plugin = await findPlugin(slug);

	if (!plugin) {
		return null;
	}

	const versions = await listVersions(plugin.id);
	const newest = versions.find((row) => row.version === plugin.version) ?? versions[0];
	const contributes = newest ? await versionContributes(newest) : undefined;

	return {
		...toSummary(plugin),
		license: plugin.license ?? '',
		homepage: plugin.homepage || null,
		repository: plugin.repository || null,
		readme: plugin.readme || null,
		versions: versions.map((row) =>
			toVersion(origin, slug, row, row === newest ? contributes : undefined)
		)
	};
}

/**
 * One version of a plugin, or the newest (`latest`) with one of `apiVersions` when given; `null`
 * when the plugin or the version doesn't exist.
 */
export async function getVersion(
	origin: string,
	slug: string,
	version: string,
	apiVersions: number[]
): Promise<PluginVersion | null> {
	const plugin = await findPlugin(slug);

	if (!plugin) {
		return null;
	}

	const versions = (await listVersions(plugin.id)).filter(
		(row) => !apiVersions.length || apiVersions.includes(row.api_version)
	);
	const row =
		version === 'latest' ? versions[0] : versions.find((item) => item.version === version);

	return row ? toVersion(origin, slug, row, await versionContributes(row)) : null;
}

/** The bundle of a version, as published; counts a download. `null` when there is none. */
export async function getBundle(slug: string, version: string): Promise<string | null> {
	const plugin = await findPlugin(slug);

	if (!plugin) {
		return null;
	}

	const bundle = await storedBundle({ plugin: plugin.id, version });

	if (bundle === null) {
		return null;
	}

	// The count is a hint; a failed update shouldn't fail the download.
	await admin()
		.db.plugins.patch(plugin.id, { downloads: (plugin.downloads ?? 0) + 1 })
		.catch((error: unknown) => console.error('Plugin registry: counting a download failed', error));

	return bundle;
}

/**
 * The icon (`manifest.icon`) of the newest version of a plugin, as SVG; `null` when the plugin or
 * its icon doesn't exist.
 */
export async function getIcon(slug: string): Promise<string | null> {
	const plugin = await findPlugin(slug);

	if (!plugin) {
		return null;
	}

	const bundle = await storedBundle({ plugin: plugin.id, version: plugin.version });

	if (bundle === null) {
		return null;
	}

	const { manifest, files } = JSON.parse(bundle) as {
		manifest: { icon?: string };
		files: Record<string, string>;
	};

	return manifest.icon && Object.hasOwn(files, manifest.icon) ? files[manifest.icon]! : null;
}
