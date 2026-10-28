import type { Snapshot, SnapshotCollection, SnapshotIndex } from '#lib/schemas/environments.js';
import type { Services } from '../services';

import { asc, sql } from 'drizzle-orm';
import { SUPPORTED_API_VERSIONS } from '@pouchbasejs/plugin-sdk';

import { POUCHBASE_INSTANCE } from '$app/env/private';
import {
	SNAPSHOT_FORMAT,
	SNAPSHOT_SECRET_KEYS,
	SNAPSHOT_SETTING_KEYS
} from '#lib/environments/snapshot.js';

import { collections, db, fields, functions, functionVersions, plugins } from '../../db';
import { queryDatabase } from '../../db/query';
import { unwrap } from '../base.service';
import { uniqueIndexName } from '../../fields/ddl';

/** Reads the snapshot of this instance: the schema and configuration another instance can apply. */

/** The setting keys a snapshot reads; `environment` says what this instance is. */
export const SNAPSHOT_KEYS = [
	...SNAPSHOT_SETTING_KEYS,
	...SNAPSHOT_SECRET_KEYS,
	'environment'
] as const;

type SettingValues = Record<(typeof SNAPSHOT_KEYS)[number], string | null>;

/**
 * Every index of the collection tables, per table: `[table, index, unique, column]` rows. Internal
 * tables (`_cf_*` of D1, which can't be read, and Pouchbase's own `_*` tables) are left out.
 */
const INDEXES_SQL = `SELECT m.name, il.name, il."unique", ii.name FROM sqlite_master AS m JOIN pragma_index_list(m.name) AS il JOIN pragma_index_info(il.name) AS ii WHERE m.type = 'table' AND substr(m.name, 1, 1) != '_' AND substr(m.name, 1, 7) != 'sqlite_' AND il.origin != 'pk' ORDER BY m.name, il.name, ii.seqno`;

/** Groups the index rows per table, leaving out the indexes owned by "Unique" fields. */
function groupIndexes(rows: unknown[][], managed: Set<string>) {
	const tables = new Map<string, Map<string, SnapshotIndex>>();

	for (const [table, name, unique, column] of rows) {
		if (managed.has(String(name))) {
			continue;
		}

		const indexes = tables.get(String(table)) ?? new Map<string, SnapshotIndex>();
		const index = indexes.get(String(name)) ?? {
			name: String(name),
			columns: [],
			unique: Number(unique) === 1
		};

		index.columns.push(String(column));
		indexes.set(String(name), index);
		tables.set(String(table), indexes);
	}

	return new Map([...tables].map(([table, indexes]) => [table, [...indexes.values()]]));
}

/** The collections with their fields and custom indexes, by name. */
export async function readCollections(appDatabaseId: string): Promise<SnapshotCollection[]> {
	const [collectionRows, fieldRows, indexRows] = await Promise.all([
		db.select().from(collections).orderBy(asc(collections.name)),
		db.select().from(fields).orderBy(asc(fields.position), asc(fields.createdAt)),
		queryDatabase(appDatabaseId, INDEXES_SQL)
	]);
	const indexes = groupIndexes(
		indexRows,
		new Set(fieldRows.filter((field) => field.unique).map(uniqueIndexName))
	);

	return collectionRows.map((collection) => ({
		id: collection.id,
		name: collection.name,
		system: collection.system,
		settings: collection.settings,
		// Positions as a rank, so gaps left by deleted fields aren't changes.
		fields: fieldRows
			.filter((field) => field.collectionId === collection.id)
			.map((field, position) => ({
				id: field.id,
				name: field.name,
				type: field.type,
				required: field.required,
				unique: field.unique,
				hidden: field.hidden,
				defaultValue: field.defaultValue,
				options: field.options,
				system: field.system,
				position
			})),
		indexes: indexes.get(collection.name) ?? []
	}));
}

/** The functions with the version that runs (not the history) and the names of their secrets. */
async function readFunctions(services: Services): Promise<Snapshot['functions']> {
	const [rows, versions] = await Promise.all([
		db.select().from(functions).orderBy(asc(functions.name)),
		db
			.select()
			.from(functionVersions)
			.where(
				sql`${functionVersions.number} = (SELECT MAX(v.number) FROM function_versions AS v WHERE v.function_id = ${functionVersions.functionId})`
			)
	]);

	return Promise.all(
		rows.map(async (row) => {
			const version = versions.find((candidate) => candidate.functionId === row.id);
			// A function that was never deployed has no Worker, and so no secrets.
			const secrets = row.url ? await services.functions().secrets(row.id) : null;

			return {
				name: row.name,
				description: row.description,
				requireAuth: row.requireAuth,
				code: version
					? { language: version.language, source: version.source, compiled: version.compiled }
					: null,
				secrets: secrets?.isOk() ? [...secrets.value].sort() : []
			};
		})
	);
}

/** The schema and configuration of this instance, as it is sent to another instance. */
export async function readSnapshot(
	services: Services,
	appDatabaseId: string,
	values: SettingValues
): Promise<Snapshot> {
	const [snapshotCollections, snapshotFunctions, pluginRows, providers] = await Promise.all([
		readCollections(appDatabaseId),
		readFunctions(services),
		db.select().from(plugins).orderBy(asc(plugins.id)),
		unwrap(services.oauthProviders().list())
	]);

	return {
		format: SNAPSHOT_FORMAT,
		instance: POUCHBASE_INSTANCE,
		environment: values.environment,
		createdAt: new Date().toISOString(),
		pluginApiVersions: [...SUPPORTED_API_VERSIONS],
		collections: snapshotCollections,
		functions: snapshotFunctions,
		plugins: pluginRows.map((row) => ({
			id: row.id,
			name: row.name,
			version: row.version,
			apiVersion: row.apiVersion,
			integrity: row.integrity,
			registryUrl: row.registryUrl
		})),
		settings: Object.fromEntries(
			SNAPSHOT_SETTING_KEYS.flatMap((key) => {
				const value = values[key];

				return value === null ? [] : [[key, value]];
			})
		),
		secrets: Object.fromEntries(SNAPSHOT_SECRET_KEYS.map((key) => [key, !!values[key]])),
		oauthProviders: providers.map((provider) => ({
			provider: provider.provider,
			label: provider.label,
			pluginId: provider.pluginId,
			enabled: provider.enabled,
			clientId: provider.clientId,
			hasSecret: provider.hasSecret
		}))
	};
}
