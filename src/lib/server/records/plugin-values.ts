import type { PluginsService } from '../services/plugins.service';
import type { Field } from '../services/fields.service';
import type { RecordInput, RecordIssues, StoredValue } from './values';

import {
	applyPluginReads,
	applyPluginWrites,
	hasPluginFields,
	planPluginReads,
	planPluginWrites
} from '../plugin-fields';

/**
 * The values of fields with a plugin's type, through their plugins (see `plugin-fields.ts` for
 * the pure planning). Throws when a plugin can't be reached.
 */

/**
 * The values to store for the fields with a plugin's type, checked and serialized by their
 * plugins (one call per plugin), and the validation messages (see `planPluginWrites`).
 */
export async function pluginValues(
	plugins: PluginsService,
	collectionFields: Field[],
	input: RecordInput,
	creating: boolean
): Promise<{ values: Record<string, StoredValue>; issues: RecordIssues }> {
	if (!hasPluginFields(collectionFields)) {
		return { values: {}, issues: {} };
	}

	const types = unwrap(await plugins.fieldTypes());
	const plan = planPluginWrites(collectionFields, input, new Set(types.map((type) => type.id)), {
		creating
	});
	const results = await Promise.all(
		plan.batches.map(async (batch) =>
			unwrap(await plugins.writeFieldValues(batch.pluginId, batch.items))
		)
	);

	return applyPluginWrites(plan, results);
}

/**
 * Turns the stored values of the fields with a plugin's type in `records` into what their
 * plugins return (`deserialize`), in place; one call per plugin. Fields whose plugin isn't
 * installed keep their stored values. Never fails: when a plugin can't be reached, the stored
 * values are kept and the failure is logged.
 */
export async function deserialize(
	plugins: PluginsService,
	collectionFields: Field[],
	records: Record<string, unknown>[]
): Promise<void> {
	if (!records.length || !hasPluginFields(collectionFields)) {
		return;
	}

	try {
		const types = unwrap(await plugins.fieldTypes());
		const batches = planPluginReads(
			collectionFields,
			records,
			new Set(types.map((type) => type.id))
		);
		const answers = await Promise.all(
			batches.map(async (batch) =>
				unwrap(await plugins.readFieldValues(batch.pluginId, batch.items))
			)
		);

		applyPluginReads(batches, answers, records);
	} catch (error) {
		console.error('[plugins] could not read the values of plugin fields', error);
	}
}

/** The value of a plugin call, or the failure as an error (its message becomes the reason). */
function unwrap<T>(result: { isErr(): boolean; value?: T; error?: unknown }): T {
	if (result.isErr()) {
		const failure = result.error as { message: string; reason?: string };

		throw new Error(failure.reason ? `${failure.message}: ${failure.reason}` : failure.message);
	}

	return result.value as T;
}
