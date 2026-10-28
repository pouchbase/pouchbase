import type { ContributionSummary, ManifestIssue, PluginVersion } from '@pouchbasejs/plugin-sdk';

import { contributionSummary, REGISTRY_API_PREFIX, SERVER_FILE } from '@pouchbasejs/plugin-sdk';
import semver from 'semver';

import type { PluginVersionRecord } from '../pouchbase';

import { admin } from '../pouchbase';

/**
 * The plugin registry (API version 1 of `@pouchbasejs/plugin-sdk`, see `registry.ts` there) on top
 * of the Pouchbase collections `plugins`, `plugin_versions` and `plugin_bundle_parts`. The routes under `/v1` and the
 * account pages call these functions (from `index.ts`); failures are thrown as a `RegistryFailure`. This file holds
 * what reading (`read.ts`) and publishing (`publish.ts`) share.
 */

/** A failed registry call, answered as `{ error: { code, message, issues } }` with `status`. */
export class RegistryFailure extends Error {
	override name = 'RegistryFailure';

	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly issues: ManifestIssue[] = []
	) {
		super(message);
	}
}

/** Fields of a version without its bundle, for lists. */
export const VERSION_FIELDS = [
	'id',
	'plugin',
	'version',
	'api_version',
	'integrity',
	'size',
	'pouchbase',
	'permissions',
	'created_at'
] as const;

export type VersionRow = Pick<PluginVersionRecord, (typeof VERSION_FIELDS)[number]>;

/** URL of the registry API on this site, e.g. `https://api.pouchbase.io/v1`. */
export function registryBase(origin: string) {
	return origin + REGISTRY_API_PREFIX;
}

function bundleUrl(origin: string, slug: string, version: string) {
	return `${registryBase(origin)}/plugins/${slug}/versions/${version}/bundle`;
}

/** A timestamp of a record (milliseconds since 1970) as ISO 8601. */
export function iso(value: number) {
	return new Date(value).toISOString();
}

/**
 * The route keys in bundled server code: the literal keys of its `routes` object, such as
 * `"GET /stats":`, which `pouchbase-plugin build` writes for every route. The registry can't run
 * the code, so this is a best effort; a hand-built `routes` object may hide some.
 */
const ROUTE_KEY_LITERAL = /["'`]((?:GET|POST|PUT|PATCH|DELETE) \/[^"'`\s]*)["'`]\s*:/g;

export function routeKeysInServerCode(code: string | undefined): string[] {
	return [...new Set([...(code ?? '').matchAll(ROUTE_KEY_LITERAL)].map((match) => match[1]!))];
}

/**
 * What a stored bundle contributes, for `PluginVersion.contributes`: from its manifest and the
 * route keys in its server code. `undefined` when the bundle can't be read.
 */
export function bundleContributes(bundle: string): ContributionSummary | undefined {
	try {
		const { manifest, files } = JSON.parse(bundle) as {
			manifest: Parameters<typeof contributionSummary>[0];
			files: Record<string, string>;
		};

		return contributionSummary(manifest, routeKeysInServerCode(files[SERVER_FILE]));
	} catch (error) {
		console.error('Plugin registry: reading the contributions of a bundle failed', error);

		return undefined;
	}
}

export function toVersion(
	origin: string,
	slug: string,
	row: VersionRow,
	contributes?: ContributionSummary
): PluginVersion {
	return {
		version: row.version,
		apiVersion: row.api_version,
		integrity: row.integrity,
		size: row.size,
		bundleUrl: bundleUrl(origin, slug, row.version),
		pouchbase: row.pouchbase || null,
		permissions: {
			network: row.permissions?.network ?? [],
			collections: {
				read: row.permissions?.collections?.read ?? [],
				write: row.permissions?.collections?.write ?? []
			}
		},
		...(contributes ? { contributes } : {}),
		publishedAt: iso(row.created_at)
	};
}

/** Newest first, by semver. */
function bySemver(a: { version: string }, b: { version: string }) {
	return semver.rcompare(a.version, b.version);
}

/** Wraps an unexpected failure of the Pouchbase instance. */
export function backendFailure(error: unknown): never {
	if (error instanceof RegistryFailure) {
		throw error;
	}

	console.error('Plugin registry: the Pouchbase back-end failed', error);

	throw new RegistryFailure(502, 'backend_unavailable', 'The registry could not reach its storage');
}

export function findPlugin(slug: string) {
	return admin().db.plugins.findFirst({ where: { slug } }).catch(backendFailure);
}

export function listVersions(pluginId: string): Promise<VersionRow[]> {
	return admin()
		.db.plugin_versions.findAll({ where: { plugin: pluginId }, select: [...VERSION_FIELDS] })
		.then((rows) => rows.sort(bySemver))
		.catch(backendFailure);
}
