import type { Services } from '../services/services';
import type { RecordContext, StoredValue } from './values';

import { USERS_COLLECTION } from '#lib/auth/users.js';

import { queryDatabase } from '../db/query';
import { deserialize } from './plugin-values';
import { relationTargetsOf, resolveRelations } from './relations';
import { signInMethods } from './sign-in-methods';
import { autoFields, columnExpression, toRecord } from './values';

/**
 * Rows as the dashboard's grid shows them: the key and every field (blobs as their size),
 * relations resolved to `{ id, label }`, plugin values deserialized, and for `users` how they
 * sign in. Throws on database errors.
 *
 * @param clause - What follows `FROM "table"`: the condition, order and limit.
 */
export async function readGrid(
	services: Services,
	context: RecordContext,
	clause: string,
	params: StoredValue[]
) {
	const { collection, fields: collectionFields, databaseId } = context;
	const { key } = autoFields(collectionFields);
	const columns = [`"${key}"`, ...collectionFields.map(columnExpression)].join(', ');
	// The relation targets don't depend on the rows, so they're read at the same time.
	const [rows, targets] = await Promise.all([
		queryDatabase(databaseId, `SELECT ${columns} FROM "${collection.name}" ${clause}`, params),
		relationTargetsOf(collectionFields)
	]);
	const items = rows.map((row) => toRecord(collectionFields, row));
	const [relationTargets, methods] = await Promise.all([
		resolveRelations(databaseId, collectionFields, items, targets),
		signInMethodsOf(
			services,
			context,
			items.map((item) => item._key)
		),
		deserialize(services.plugins(), collectionFields, items)
	]);

	return { items, relationTargets, signInMethods: methods };
}

/** How these users sign in, for the built-in `users` collection; `undefined` for any other. */
async function signInMethodsOf(
	services: Services,
	{ collection, databaseId }: RecordContext,
	userIds: string[]
) {
	if (!collection.system || collection.name !== USERS_COLLECTION) {
		return undefined;
	}

	// Labels and logos are a nicety: without them the provider id is shown.
	const labels = (await services.oauthProviders().labels()).unwrapOr(new Map());

	return signInMethods(databaseId, userIds, labels);
}
