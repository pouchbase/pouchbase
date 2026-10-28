import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TEMPLATES, projectFiles } from '../src/cli/templates/index.js';
import { MANIFEST_SCHEMA_URL, PLUGIN_CATEGORIES, manifestJsonSchema } from '../src/index.js';

describe('manifestJsonSchema', () => {
	it('is a draft 2020-12 schema without the package.json fields as required', () => {
		const schema = manifestJsonSchema();

		expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
		expect(schema.$id).toBe(MANIFEST_SCHEMA_URL);
		expect(schema.required).toEqual(['id']);
		expect(Object.keys(schema.properties as object)).toContain('$schema');
		expect(
			(schema.properties as { categories: { items: { enum: string[] } } }).categories.items.enum
		).toEqual([...PLUGIN_CATEGORIES]);
	});

	it('leaves out the keys the CLI generates from plugin.ts', () => {
		const properties = manifestJsonSchema().properties as Record<string, unknown>;

		for (const key of ['settings', 'contributes', 'server']) {
			expect(properties[key]).toBeUndefined();
		}
	});

	it('accepts the manifest of every template and of the demo', () => {
		const schema = manifestJsonSchema();
		const manifests: [string, unknown][] = [
			...TEMPLATES.map((template): [string, unknown] => [
				template,
				JSON.parse(projectFiles('auth-acme', template, '0.0.0')['pouchbase-plugin.json']!)
			]),
			[
				'demo',
				JSON.parse(
					readFileSync(
						fileURLToPath(
							new URL('../../../examples/plugin-demo/pouchbase-plugin.json', import.meta.url)
						),
						'utf8'
					)
				)
			]
		];

		for (const [name, manifest] of manifests) {
			expect({ name, problems: schemaProblems(schema, manifest) }).toEqual({ name, problems: [] });
		}

		// The check itself finds problems.
		expect(schemaProblems(schema, { id: 'Xyz', settings: [], colour: 'red' })).toEqual([
			'$.id: does not match ^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',
			'$.settings: unknown key',
			'$.colour: unknown key'
		]);
	});
});

/**
 * What `value` breaks of a JSON Schema, for the keywords `manifestJsonSchema` uses: `type`,
 * `enum`, `required`, `properties` (unknown keys count as problems), `items`,
 * `pattern`, `minLength`, `maxLength`, `maxItems`, `exclusiveMinimum` and `maximum`.
 */
function schemaProblems(schema: Record<string, unknown>, value: unknown, path = '$'): string[] {
	const problems: string[] = [];
	const type = schema.type as string | undefined;
	const actual = Array.isArray(value)
		? 'array'
		: value === null
			? 'null'
			: Number.isInteger(value)
				? 'integer'
				: typeof value;

	if (type && type !== actual && !(type === 'number' && actual === 'integer')) {
		return [`${path}: expected ${type}, got ${actual}`];
	}

	if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
		problems.push(`${path}: not one of ${schema.enum.join(', ')}`);
	}

	if (typeof value === 'string') {
		if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) {
			problems.push(`${path}: does not match ${schema.pattern}`);
		}

		if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
			problems.push(`${path}: shorter than ${schema.minLength}`);
		}

		if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
			problems.push(`${path}: longer than ${schema.maxLength}`);
		}
	}

	if (typeof value === 'number') {
		if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
			problems.push(`${path}: not above ${schema.exclusiveMinimum}`);
		}

		if (typeof schema.maximum === 'number' && value > schema.maximum) {
			problems.push(`${path}: above ${schema.maximum}`);
		}
	}

	if (Array.isArray(value)) {
		if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
			problems.push(`${path}: more than ${schema.maxItems} items`);
		}

		if (schema.items && typeof schema.items === 'object') {
			value.forEach((item, index) =>
				problems.push(
					...schemaProblems(schema.items as Record<string, unknown>, item, `${path}[${index}]`)
				)
			);
		}
	}

	if (actual === 'object' && schema.properties) {
		const properties = schema.properties as Record<string, Record<string, unknown>>;
		const object = value as Record<string, unknown>;

		for (const key of (schema.required as string[] | undefined) ?? []) {
			if (!(key in object)) {
				problems.push(`${path}: lacks ${key}`);
			}
		}

		for (const [key, item] of Object.entries(object)) {
			const property = properties[key];

			if (!property) {
				problems.push(`${path}.${key}: unknown key`);
			} else {
				problems.push(...schemaProblems(property, item, `${path}.${key}`));
			}
		}
	}

	return problems;
}
