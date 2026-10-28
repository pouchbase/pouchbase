import type { PluginVersion } from '@pouchbasejs/plugin-sdk';

import { isPouchbaseError } from '@pouchbasejs/js-sdk';
import {
	computeIntegrity,
	effectiveCategories,
	isSupportedApiVersion,
	parseBundle,
	serializeBundle,
	splitBundle,
	unknownCategoryIssues
} from '@pouchbasejs/plugin-sdk';
import semver from 'semver';

import type { PluginRecord } from '../pouchbase';

import { admin } from '../pouchbase';
import {
	backendFailure,
	bundleContributes,
	findPlugin,
	listVersions,
	registryBase,
	RegistryFailure,
	toVersion,
	VERSION_FIELDS
} from './shared';

/** Publishing to the registry: storing a new version and listing a user's own plugins. */

/** URL of a plugin's icon; `v` changes with every version, so it can be cached for good. */
function iconUrl(origin: string, slug: string, version: string) {
	return `${registryBase(origin)}/plugins/${slug}/icon?v=${encodeURIComponent(version)}`;
}

/** API versions as `plugins.api_versions` stores them: `,1,2,`. */
function apiVersionList(versions: number[]) {
	return `,${[...new Set(versions)].sort((a, b) => a - b).join(',')},`;
}

/** Categories as `plugins.categories_text` stores them: `,auth,fields,`. */
function categoryList(categories: string[]) {
	return categories.length ? `,${categories.join(',')},` : '';
}

/** The plugins of a user, newest first, for the account pages. */
export async function listOwnPlugins(userId: string): Promise<PluginRecord[]> {
	return admin()
		.db.plugins.findAll({ where: { owner: userId }, orderBy: { created_at: 'desc' } })
		.catch(backendFailure);
}

/**
 * Stores the parts of a bundle after the first one for version `id`. When one fails, the version
 * goes again, so no version is listed without its whole bundle; then it throws.
 */
async function storeParts(id: string, parts: string[]) {
	const db = admin().db;

	try {
		// One at a time: each part is a request of up to 1.5 MB.
		for (const [index, data] of parts.entries()) {
			await db.plugin_bundle_parts.insert(
				{ version: id, part: index + 1, data },
				{ select: ['id'] }
			);
		}
	} catch (error) {
		const stored = await db.plugin_bundle_parts
			.findAll({ where: { version: id }, select: ['id'] })
			.catch(() => []);

		await Promise.all(stored.map((part) => db.plugin_bundle_parts.remove(part.id))).catch(
			() => undefined
		);
		await db.plugin_versions.remove(id).catch(() => undefined);

		throw error;
	}
}

/**
 * Publishes a bundle as a new version of plugin `slug` for user `userId`. The first version of a
 * plugin makes the user its owner; after that, only the owner can publish. Fails with `422` for an
 * invalid bundle, `403` for someone else's plugin and `409` for a version that exists.
 */
export async function publishVersion(
	origin: string,
	userId: string,
	slug: string,
	bytes: Uint8Array
): Promise<PluginVersion> {
	const parsed = parseBundle(bytes);

	if (!parsed.success) {
		throw new RegistryFailure(422, 'invalid_bundle', 'The bundle is not valid', parsed.issues);
	}

	const { manifest } = parsed.bundle;

	if (manifest.id !== slug) {
		throw new RegistryFailure(422, 'invalid_bundle', `The bundle is for ${manifest.id}`, [
			{ path: 'manifest.id', message: `Must be ${slug}` }
		]);
	}

	if (!isSupportedApiVersion(manifest.apiVersion)) {
		throw new RegistryFailure(
			422,
			'invalid_bundle',
			'The registry does not know this API version',
			[
				{
					path: 'manifest.apiVersion',
					message: `API version ${manifest.apiVersion} is not supported`
				}
			]
		);
	}

	const categoryIssues = unknownCategoryIssues(manifest.categories).map((issue) => ({
		...issue,
		path: `manifest.${issue.path}`
	}));

	if (categoryIssues.length) {
		throw new RegistryFailure(
			422,
			'invalid_bundle',
			'The bundle has unknown categories',
			categoryIssues
		);
	}

	const existing = await findPlugin(slug);

	if (existing && existing.owner !== userId) {
		throw new RegistryFailure(403, 'forbidden', `${slug} belongs to another account`);
	}

	if (existing) {
		const versions = await listVersions(existing.id);

		if (versions.some((row) => row.version === manifest.version)) {
			throw new RegistryFailure(
				409,
				'version_exists',
				`${slug}@${manifest.version} is already published`
			);
		}
	}

	// Stored and served as serialized here, so the integrity matches the bytes hosts download.
	const serialized = serializeBundle(parsed.bundle);
	const bundle = new TextDecoder().decode(serialized);
	const [first = '', ...rest] = splitBundle(bundle);
	const integrity = await computeIntegrity(serialized);
	const categories = effectiveCategories(manifest);
	const metadata = {
		name: manifest.name,
		description: manifest.description,
		author: manifest.author?.name ?? null,
		license: manifest.license,
		homepage: manifest.homepage ?? null,
		repository: manifest.repository ?? null,
		icon_url: manifest.icon ? iconUrl(origin, slug, manifest.version) : null,
		keywords: manifest.keywords,
		categories,
		categories_text: categoryList(categories),
		version: manifest.version,
		api_version: manifest.apiVersion
	};
	const db = admin().db;

	try {
		let plugin = existing;

		if (!plugin) {
			plugin = await db.plugins.insert({
				...metadata,
				slug,
				owner: userId,
				readme: null,
				api_versions: apiVersionList([manifest.apiVersion]),
				downloads: 0,
				verified: false
			});
		} else {
			const apiVersions = apiVersionList([
				...(plugin.api_versions ?? '').split(',').filter(Boolean).map(Number),
				manifest.apiVersion
			]);
			const newest = semver.gt(manifest.version, plugin.version);

			plugin = await db.plugins.patch(
				plugin.id,
				newest ? { ...metadata, api_versions: apiVersions } : { api_versions: apiVersions }
			);
		}

		const row = await db.plugin_versions.insert(
			{
				plugin: plugin.id,
				version: manifest.version,
				api_version: manifest.apiVersion,
				integrity,
				size: serialized.byteLength,
				pouchbase: manifest.engines.pouchbase ?? null,
				permissions: manifest.permissions,
				bundle: first
			},
			{ select: [...VERSION_FIELDS] }
		);

		await storeParts(row.id, rest);

		return toVersion(origin, slug, row, bundleContributes(bundle));
	} catch (error) {
		// Unique indexes on `plugins.slug` and `plugin_versions (plugin, version)` catch a publish
		// that raced this one.
		if (isPouchbaseError(error) && error.status === 409) {
			throw new RegistryFailure(
				409,
				'version_exists',
				`${slug}@${manifest.version} was just published`
			);
		}

		return backendFailure(error);
	}
}
