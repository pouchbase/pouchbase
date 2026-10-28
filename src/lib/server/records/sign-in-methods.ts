import type { SignInMethod } from '#lib/auth/sign-in-methods.js';

import { batchDatabase } from '../db/query';
import { placeholders } from './values';

/** Label and logo of a sign-in provider, by provider id. */
type ProviderLabels = Map<string, { label: string; iconUrl: string | null }>;

/**
 * Linked OAuth accounts and passwords of these users, read from the internal `_external_auths`
 * and `_passwords` tables of the app database. Throws on database errors.
 */
export async function signInMethods(
	databaseId: string,
	userIds: string[],
	providers: ProviderLabels
): Promise<Record<string, SignInMethod[]>> {
	const methods: Record<string, SignInMethod[]> = Object.fromEntries(userIds.map((id) => [id, []]));

	if (!userIds.length) {
		return methods;
	}

	const [linked, passwords] = await batchDatabase(databaseId, [
		{
			sql: `SELECT "user_id", "provider", "provider_id", "created_at" FROM "_external_auths" WHERE "user_id" IN (${placeholders(userIds)}) ORDER BY "created_at"`,
			params: userIds
		},
		{
			sql: `SELECT "user_id", "updated_at" FROM "_passwords" WHERE "user_id" IN (${placeholders(userIds)})`,
			params: userIds
		}
	]);

	for (const [userId, provider, providerId, createdAt] of linked) {
		const id = String(provider);

		methods[String(userId)]?.push({
			provider: id,
			label: providers.get(id)?.label ?? id,
			iconUrl: providers.get(id)?.iconUrl ?? null,
			providerId: String(providerId),
			linkedAt: Number(createdAt)
		});
	}

	for (const [userId, updatedAt] of passwords) {
		methods[String(userId)]?.push({
			provider: 'password',
			label: 'Password',
			iconUrl: null,
			providerId: null,
			linkedAt: Number(updatedAt)
		});
	}

	return methods;
}
