import { z } from 'zod';

/**
 * The collections a plugin contributes (`contributes.collections` of the manifest): the host
 * creates them, prefixed with the plugin id, on install.
 */

/** `posts`, `order_items`: a collection's name, as the host's records API has it. */
export const COLLECTION_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

/** Longest collection name a host accepts, the plugin's prefix included. */
export const MAX_COLLECTION_NAME_LENGTH = 63;

/**
 * The host's name of a plugin's collection: the plugin id with `_` for `-`, a `_` and the name
 * (`pluginCollectionName('plugin-demo', 'reviews')` is `plugin_demo_reviews`). The prefix keeps
 * them apart from the app's collections and those of other plugins.
 */
export function pluginCollectionName(pluginId: string, name: string): string {
	return `${pluginId.replaceAll('-', '_')}_${name}`;
}

/** The actions of the records API that an API rule covers. */
const COLLECTION_RULE_ACTIONS = ['list', 'view', 'create', 'update', 'delete'] as const;

/**
 * A field of a plugin's collection, in the shape of the schema API (`pouch.schema.create()`): a
 * built-in type (`text`, `number`, `relation`, ...) or a plugin's `<plugin>:<type>`. The host checks
 * the type and the options in full when it creates the collection.
 */
const collectionFieldSchema = z.object({
	name: z.string().min(1).max(63),
	type: z.string().min(1).max(97),
	required: z.boolean().default(false),
	unique: z.boolean().default(false),
	/** The default value, as the dashboard stores it (a string); `null` for none. */
	defaultValue: z.string().nullable().default(null),
	/**
	 * The field's options, as `FieldOptions` of the JS SDK. A `relation` names the related
	 * collection with `collection` instead of `collectionId`: one of the plugin's own collections by
	 * its name in `collections` (`reviews`), else a collection of the app (`posts`).
	 */
	options: z.record(z.string(), z.unknown()).default({})
});

const collectionIndexSchema = z.object({
	columns: z.array(z.string().min(1)).min(1),
	unique: z.boolean().default(false)
});

/**
 * A collection the plugin contributes. The host creates it on install as
 * `pluginCollectionName(plugin, name)` and brings it in line on every update; it keeps fields
 * that a later version leaves out, and it deletes the collection with its records when the plugin
 * is removed. The plugin can always read and write its own collections through `ctx.pouch`.
 */
export const collectionContributionSchema = z.object({
	/** Without the prefix: `reviews` becomes `<plugin>_reviews`. */
	name: z
		.string()
		.regex(
			COLLECTION_NAME_PATTERN,
			'Start with a letter and use only lowercase letters, numbers and underscores'
		),
	/** The fields in display order; `id`, `created_at` and `updated_at` are added when missing. */
	fields: z.array(collectionFieldSchema).max(200).default([]),
	indexes: z.array(collectionIndexSchema).max(100).default([]),
	/**
	 * API rules for app users, per action: `""` allows everyone, a condition those it matches.
	 * Missing or `null` is admins only, so only the plugin and the dashboard reach the records.
	 */
	rules: z
		.partialRecord(z.enum(COLLECTION_RULE_ACTIONS), z.string().max(2000).nullable())
		.default({})
});

export type CollectionContribution = z.output<typeof collectionContributionSchema>;
