import type { ManifestIssue, PluginManifest } from '@pouchbasejs/plugin-sdk';
import type { SnapshotCollection } from '#lib/schemas/environments.js';

import { pluginCollectionName } from '@pouchbasejs/plugin-sdk';
import { BUILT_IN_DEFAULT_FIELDS } from '#lib/fields/field-types.js';

/**
 * The collections a plugin contributes (`contributes.collections`), turned into what the schema
 * API takes; `PluginsService.applyCollections` creates and updates them with it.
 */

/** A field as `apiCreateCollectionSchema` takes it, before it is checked. */
export type FieldInput = Record<string, unknown> & { name: string; type: string };

export type CollectionContribution = PluginManifest['contributes']['collections'][number];

/**
 * The fields of a plugin's collection as the schema API takes them: the manifest's fields, with
 * `options.collection` of a relation turned into the `collectionId` of `ids` (by the host's
 * name), after the default `id`, `created_at` and `updated_at` fields it lacks; and, for a
 * collection that exists, every field it has that the manifest leaves out, so no data is lost.
 */
export function collectionFields(
	manifest: PluginManifest,
	contribution: CollectionContribution,
	ids: ReadonlyMap<string, string>,
	existing: SnapshotCollection | null
): { fields: FieldInput[] } | { issue: ManifestIssue } {
	const own = new Set(manifest.contributes.collections.map((collection) => collection.name));
	const declared: FieldInput[] = [];

	for (const [index, field] of contribution.fields.entries()) {
		const { collection, ...options } = field.options;

		if (collection === undefined) {
			declared.push({ ...field, options });
			continue;
		}

		const target =
			typeof collection === 'string' && own.has(collection)
				? pluginCollectionName(manifest.id, collection)
				: String(collection);
		const id = ids.get(target);

		if (!id) {
			return {
				issue: {
					path: `contributes.collections.${contribution.name}.fields.${index}.options.collection`,
					message: `There is no collection ${target}`
				}
			};
		}

		declared.push({ ...field, options: { ...options, collectionId: id } });
	}

	const names = new Set(declared.map((field) => field.name));
	const kept: FieldInput[] = (existing?.fields ?? [])
		.filter((field) => !names.has(field.name))
		.map(({ id, name, type, required, unique, defaultValue, options }) => ({
			id,
			name,
			type,
			required,
			unique,
			defaultValue,
			options
		}));
	const types = new Set<string>([...declared, ...kept].map((field) => field.type));
	const defaults = BUILT_IN_DEFAULT_FIELDS.filter((field) => !types.has(field.type)).map(
		(field) => ({ ...field, options: { ...field.options } })
	);

	return { fields: [...defaults, ...kept, ...declared] };
}

/** Indexes of the manifest, and those an admin added to the collection since. */
export function collectionIndexes(
	contribution: CollectionContribution,
	existing: SnapshotCollection | null
) {
	const key = (index: { columns: string[]; unique: boolean }) =>
		`${index.unique}:${index.columns.join(',')}`;
	const declared = new Set(contribution.indexes.map(key));

	return [
		...contribution.indexes,
		...(existing?.indexes ?? [])
			.filter((index) => !declared.has(key(index)))
			.map(({ columns, unique }) => ({ columns, unique }))
	];
}
