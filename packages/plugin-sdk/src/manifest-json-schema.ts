import { z } from 'zod';

import { PLUGIN_CATEGORIES } from './categories.js';
import {
	GENERATED_MANIFEST_KEYS,
	MANIFEST_SCHEMA_URL,
	PACKAGE_DEFAULT_KEYS,
	manifestSchema
} from './manifest.js';

/**
 * The JSON Schema of `pouchbase-plugin.json` (draft 2020-12), served at `MANIFEST_SCHEMA_URL`
 * and printed by `pouchbase-plugin schema`. Fields that `package.json` can fill are optional, so
 * is `apiVersion` (the CLI writes `API_VERSION`), `categories` lists the known categories, which
 * the CLI requires, and the `GENERATED_MANIFEST_KEYS` are left out.
 */
export function manifestJsonSchema(): Record<string, unknown> {
	const schema = z.toJSONSchema(manifestSchema, {
		target: 'draft-2020-12',
		io: 'input',
		unrepresentable: 'any'
	}) as Record<string, unknown>;
	const properties = schema.properties as Record<string, Record<string, unknown>>;
	const optional = new Set<string>([
		...PACKAGE_DEFAULT_KEYS,
		'apiVersion',
		...GENERATED_MANIFEST_KEYS
	]);

	if (properties.categories?.items) {
		properties.categories.items = { type: 'string', enum: [...PLUGIN_CATEGORIES] };
	}

	for (const key of GENERATED_MANIFEST_KEYS) {
		delete properties[key];
	}

	const required = Array.isArray(schema.required)
		? (schema.required as string[]).filter((key) => !optional.has(key))
		: [];

	return {
		...schema,
		$id: MANIFEST_SCHEMA_URL,
		title: 'Pouchbase plugin manifest',
		required
	};
}
