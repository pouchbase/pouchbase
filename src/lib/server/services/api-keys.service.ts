import type { ServiceError } from './base.service';
import type { ResultAsync } from 'neverthrow';

import { and, desc, eq, isNull, ne, type SQL } from 'drizzle-orm';
import { okAsync } from 'neverthrow';

import { generateToken, hashToken } from '../crypto';
import { apiKeys, functions } from '../db';
import { Service } from './base.service';

/**
 * API keys: secrets for server-side code (back-ends and functions) to call the parts of the API an
 * app user can't, such as `/api/mail/send`. Keys are sent as `Authorization: Bearer pbk_…`.
 * Every key acts as an admin: it reaches the whole API, and the collections' API rules don't apply
 * to it. Admins create keys on the API keys page; every deployed function gets a key of its own as
 * `POUCHBASE_API_KEY`, renewed on each deploy. The Worker of an installed plugin has a key too,
 * also renewed on each deploy, which only reaches the records API of the collections the plugin
 * may use (see `PluginsService.grant`); those keys aren't listed.
 */

/** An API key as the API keys page lists it; the key itself is only shown once. */
export type ApiKey = {
	id: string;
	name: string;
	/** The first characters of the key. */
	prefix: string;
	/** Set for the key of a function. */
	functionName: string | null;
	/** Set for the key of a plugin. */
	pluginId: string | null;
	createdAt: Date;
	lastUsedAt: Date | null;
};

export type ApiKeysError =
	| ServiceError<23000, 'API_KEYS_QUERY_FAILED'>
	| ServiceError<23001, 'API_KEY_NOT_FOUND'>
	| ServiceError<23002, 'FUNCTION_KEY'>
	| ServiceError<23003, 'PLUGIN_KEY'>;

/** Prefix of API keys, so they are recognisable (e.g. by secret scanners). */
export const API_KEY_PREFIX = 'pbk_';

/** `last_used_at` is written at most this often per key. */
const LAST_USED_INTERVAL = 60 * 1000;

const COLUMNS = {
	id: apiKeys.id,
	name: apiKeys.name,
	prefix: apiKeys.prefix,
	functionName: functions.name,
	pluginId: apiKeys.pluginId,
	createdAt: apiKeys.createdAt,
	lastUsedAt: apiKeys.lastUsedAt
};

function newKey() {
	const key = `${API_KEY_PREFIX}${generateToken()}`;

	return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 6) };
}

export class ApiKeysService extends Service {
	/** Every key, newest first; the keys of functions too, not those of plugins. */
	list(): ResultAsync<ApiKey[], ApiKeysError> {
		return this.run(
			() =>
				this.db
					.select(COLUMNS)
					.from(apiKeys)
					.leftJoin(functions, eq(functions.id, apiKeys.functionId))
					.where(isNull(apiKeys.pluginId))
					.orderBy(desc(apiKeys.createdAt)),
			this.failed
		);
	}

	/** Creates a key; `key` can't be read back later. */
	create(name: string): ResultAsync<ApiKey & { key: string }, ApiKeysError> {
		return this.run(async () => {
			const { key, prefix } = newKey();
			const [row] = await this.db
				.insert(apiKeys)
				.values({ name, prefix, keyHash: await hashToken(key) })
				.returning();

			return {
				id: row.id,
				name: row.name,
				prefix: row.prefix,
				functionName: null,
				pluginId: null,
				createdAt: row.createdAt,
				lastUsedAt: row.lastUsedAt,
				key
			};
		}, this.failed);
	}

	/** Deletes a key; the key of a function or a plugin goes with it. */
	delete(id: string): ResultAsync<void, ApiKeysError> {
		return this.run(async () => {
			const [row] = await this.db
				.select({ functionId: apiKeys.functionId, pluginId: apiKeys.pluginId })
				.from(apiKeys)
				.where(eq(apiKeys.id, id));

			if (!row) {
				this.fail(23001, 'API_KEY_NOT_FOUND');
			}

			if (row.pluginId) {
				this.fail(23003, 'PLUGIN_KEY');
			}

			if (row.functionId) {
				this.fail(23002, 'FUNCTION_KEY');
			}

			await this.db.delete(apiKeys).where(eq(apiKeys.id, id));
		}, this.failed);
	}

	/** The key with this value, `null` when there is none; records that it was used. */
	verify(key: string): ResultAsync<ApiKey | null, ApiKeysError> {
		if (!key.startsWith(API_KEY_PREFIX)) {
			return okAsync(null);
		}

		return this.run(async () => {
			const [row] = await this.db
				.select(COLUMNS)
				.from(apiKeys)
				.leftJoin(functions, eq(functions.id, apiKeys.functionId))
				.where(eq(apiKeys.keyHash, await hashToken(key)));

			if (!row) {
				return null;
			}

			const now = new Date();

			if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_INTERVAL) {
				await this.db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, row.id));
			}

			return { ...row, lastUsedAt: now };
		}, this.failed);
	}

	/**
	 * A new key for a function, for its next deploy. Once that deploy succeeds, `keepFunctionKey`
	 * removes the function's older keys; when it fails, `deleteFunctionKey` removes the new one.
	 */
	issueFunctionKey(
		functionId: string,
		functionName: string
	): ResultAsync<{ id: string; key: string }, ApiKeysError> {
		return this.issue({ name: `Function ${functionName}`, functionId });
	}

	/** Removes the function's keys other than this one (the key of the version that runs). */
	keepFunctionKey(functionId: string, id: string): ResultAsync<void, ApiKeysError> {
		return this.remove(and(eq(apiKeys.functionId, functionId), ne(apiKeys.id, id)));
	}

	deleteFunctionKey(id: string): ResultAsync<void, ApiKeysError> {
		return this.remove(eq(apiKeys.id, id));
	}

	/**
	 * A new key for a plugin's Worker, for its next deploy. Once that deploy succeeds,
	 * `keepPluginKey` removes the plugin's older keys; when it fails, `deleteFunctionKey` removes
	 * the new one.
	 */
	issuePluginKey(pluginId: string): ResultAsync<{ id: string; key: string }, ApiKeysError> {
		return this.issue({ name: `Plugin ${pluginId}`, pluginId });
	}

	/** Removes the plugin's keys other than this one (the key of the Worker that runs). */
	keepPluginKey(pluginId: string, id: string): ResultAsync<void, ApiKeysError> {
		return this.remove(and(eq(apiKeys.pluginId, pluginId), ne(apiKeys.id, id)));
	}

	/** Removes every key of the plugin, e.g. when it is removed. */
	deletePluginKeys(pluginId: string): ResultAsync<void, ApiKeysError> {
		return this.remove(eq(apiKeys.pluginId, pluginId));
	}

	/** A key for a function or a plugin: not listed, replaced on every deploy. */
	private issue(owner: { name: string; functionId?: string; pluginId?: string }) {
		return this.run(async () => {
			const { key, prefix } = newKey();
			const [row] = await this.db
				.insert(apiKeys)
				.values({ ...owner, prefix, keyHash: await hashToken(key) })
				.returning({ id: apiKeys.id });

			return { id: row.id, key };
		}, this.failed);
	}

	private remove(where: SQL | undefined) {
		return this.run(async () => {
			await this.db.delete(apiKeys).where(where);
		}, this.failed);
	}

	private failed = (error: unknown) => this.error(23000, 'API_KEYS_QUERY_FAILED', error);
}
