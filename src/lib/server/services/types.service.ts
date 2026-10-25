import type { ErrorOf, ServiceError } from './base.service';
import type { Collection } from './collections.service';
import type { Field } from './fields.service';
import type { PluginFieldType, PluginsService } from './plugins.service';
import type { ResultAsync } from 'neverthrow';

import { splitPluginFieldType } from '@pouchbasejs/plugin-sdk';
import { asc, inArray } from 'drizzle-orm';
import { fromPromise, okAsync } from 'neverthrow';

import { fieldTypeInfo } from '#lib/fields/field-type-info.js';
import { isAutoType, isRelationType } from '#lib/fields/field-types.js';
import { fieldValueType } from '#lib/fields/value-types.js';

import { generateToken, hashToken } from '../crypto';
import { collections, fields, plugins } from '../db';
import { hasPluginFields } from '../plugin-fields';
import { Service } from './base.service';

/** `blog_posts` → `BlogPosts`. */
function pascalCase(collection: string) {
	return collection
		.split('_')
		.filter(Boolean)
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join('');
}

/** Whether the API returns an array for the field, `[]` when empty. */
function isMultiple(field: Field) {
	return (
		(field.type === 'relation' || field.type === 'file' || field.type === 'list') &&
		!!field.options.multiple
	);
}

/** What the declarations need to know of the plugin field types. */
type PluginTypes = {
	/** The installed plugin field types, for their labels. */
	installed: readonly PluginFieldType[];
	/** Ids of the installed types whose plugin deserializes the stored values (or may). */
	deserializes: ReadonlySet<string>;
};

/** A JSDoc comment for a field. */
function fieldDoc(field: Field, note: string | undefined, pluginTypes: PluginTypes) {
	const label = fieldTypeInfo(field, pluginTypes.installed).label;
	const doc = [`\`${field.name}\` · ${label}${field.required ? ', required' : ''}.`, note]
		.filter(Boolean)
		.join(' ');

	return `\t/** ${doc.replace(/\*\//g, '* /')} */`;
}

/**
 * TypeScript declarations for every collection, matching the records API:
 *
 * - `<Name>Record`: a record as the API returns it. Fields that are required or filled in by
 *   Pouchbase are not nullable; multiple relations, files and lists are arrays.
 * - `<Name>Create`: what to send to create one. Fields Pouchbase fills in (id, timestamps,
 *   computed fields) are left out; required fields without a default are required.
 * - `Schema`: both per collection, for the SDK: `createClient<Schema>(url)`.
 * - `Collections`: the record type per collection.
 */
function declarations(list: Collection[], all: Field[], pluginTypes: PluginTypes) {
	const collectionNames = new Map(list.map((collection) => [collection.id, collection.name]));
	const used = new Set<string>();
	const names = list.map((collection) => {
		const base = pascalCase(collection.name);
		let name = base;

		for (let suffix = 2; used.has(name); suffix++) {
			name = `${base}${suffix}`;
		}

		used.add(name);

		return name;
	});

	const interfaces = list.map((collection, index) => {
		// The records API leaves blobs out.
		const own = all.filter(
			(field) => field.collectionId === collection.id && field.type !== 'blob'
		);
		const target = (field: Field) =>
			field.options.collectionId ? collectionNames.get(field.options.collectionId) : undefined;

		const record = own.flatMap((field) => {
			const value = fieldValueType(field, target(field), {
				deserializes: pluginTypes.deserializes.has(field.type)
			});
			const filled = field.type === 'id' || field.type === 'created' || field.type === 'updated';
			const nullable = !filled && !field.required && !isMultiple(field);

			return [
				fieldDoc(field, value.note, pluginTypes),
				`\t${field.name}: ${value.type}${nullable ? ' | null' : ''};`
			];
		});

		const create = own
			.filter((field) => !isAutoType(field.type) && field.type !== 'computed')
			.flatMap((field) => {
				const value = fieldValueType(field, target(field), {
					deserializes: pluginTypes.deserializes.has(field.type)
				});
				const optional = !field.required || !!field.defaultValue;
				// Dates may also be sent as a `Date`; it is sent as ISO 8601 text.
				const type = field.type === 'date' ? `${value.type} | Date` : value.type;

				return [
					fieldDoc(field, value.note, pluginTypes),
					`\t${field.name}${optional ? '?' : ''}: ${type}${optional ? ' | null' : ''};`
				];
			});

		return [
			`/** A record of \`${collection.name}\`, as the API returns it. */`,
			`export interface ${names[index]}Record {`,
			...record,
			'}',
			'',
			`/** The fields to send to create a record of \`${collection.name}\`. */`,
			`export interface ${names[index]}Create {`,
			...create,
			'}'
		].join('\n');
	});

	/** `; $relations: { author: 'users' }` for a collection with relation or file fields. */
	const relations = (collection: Collection) => {
		const entries = all
			.filter(
				(field) =>
					field.collectionId === collection.id &&
					isRelationType(field.type) &&
					collectionNames.has(field.options.collectionId ?? '')
			)
			.map(
				(field) =>
					`${field.name}: ${JSON.stringify(collectionNames.get(field.options.collectionId!))}`
			);

		return entries.length ? `; $relations: { ${entries.join('; ')} }` : '';
	};

	const schema = [
		'/**',
		' * Every collection, by name, with its record and create types and the collection each relation',
		' * points to (`$relations`): `createClient<Schema>(url)`.',
		' */',
		'export interface Schema {',
		...list.map(
			(collection, index) =>
				`\t${collection.name}: { $record: ${names[index]}Record; $create: ${names[index]}Create${relations(collection)} };`
		),
		'}'
	].join('\n');

	const map = [
		'/** The record type of every collection, by name. */',
		'export interface Collections {',
		...list.map((collection, index) => `\t${collection.name}: ${names[index]}Record;`),
		'}'
	].join('\n');

	const json = [
		'/** A value of a JSON field. */',
		'export type JsonValue =',
		'\t| string',
		'\t| number',
		'\t| boolean',
		'\t| null',
		'\t| JsonValue[]',
		'\t| { [key: string]: JsonValue };'
	].join('\n');

	return (
		[
			[
				'/**',
				' * Types of the collections, generated by Pouchbase.',
				' * Generate them again after changing a collection; edits to this file are overwritten.',
				' */'
			].join('\n'),
			json,
			...interfaces,
			schema,
			map
		].join('\n\n') + '\n'
	);
}

export class TypesService extends Service {
	/** TypeScript declarations of every collection and its fields. */
	generate(): ResultAsync<
		string,
		| ServiceError<5000, 'GET_SETTING_FAILED'>
		| ServiceError<17000, 'LIST_COLLECTIONS_FAILED'>
		| ServiceError<17001, 'LIST_FIELDS_FAILED'>
		| ErrorOf<ReturnType<PluginsService['fieldTypes']>>
	> {
		return fromPromise(this.db.select().from(collections).orderBy(asc(collections.name)), (error) =>
			this.error(17000, 'LIST_COLLECTIONS_FAILED', error)
		).andThen((list) =>
			// One query for the fields of every collection, instead of one per collection.
			fromPromise(
				this.db.select().from(fields).orderBy(asc(fields.position), asc(fields.createdAt)),
				(error) => this.error(17001, 'LIST_FIELDS_FAILED', error)
			).andThen((all) =>
				this.pluginTypes(all).map((pluginTypes) => declarations(list, all, pluginTypes))
			)
		);
	}

	/**
	 * The installed plugin field types, and which of them the API returns deserialized: a type
	 * whose handler has `deserialize`, as the plugin described itself when it was installed. A
	 * built-in plugin, or one that didn't describe its handlers, may deserialize.
	 */
	private pluginTypes(
		all: Field[]
	): ResultAsync<
		PluginTypes,
		ErrorOf<ReturnType<PluginsService['fieldTypes']>> | ServiceError<17001, 'LIST_FIELDS_FAILED'>
	> {
		if (!hasPluginFields(all)) {
			return okAsync({ installed: [], deserializes: new Set() });
		}

		return this.services
			.plugins()
			.fieldTypes()
			.andThen((installed) => {
				const ids = [...new Set(installed.map((type) => type.pluginId))];

				return fromPromise(
					ids.length
						? this.db
								.select({ id: plugins.id, capabilities: plugins.capabilities })
								.from(plugins)
								.where(inArray(plugins.id, ids))
						: Promise.resolve([]),
					(error) => this.error(17001, 'LIST_FIELDS_FAILED', error)
				).map((rows) => {
					const capabilities = new Map(rows.map((row) => [row.id, row.capabilities]));
					const deserializes = new Set(
						installed
							.filter((type) => {
								const handlers = capabilities.get(type.pluginId)?.fieldHandlers;
								const own = splitPluginFieldType(type.id)?.type ?? type.type;

								return !handlers || (Object.hasOwn(handlers, own) && handlers[own].deserialize);
							})
							.map((type) => type.id)
					);

					return { installed, deserializes };
				});
			});
	}

	/** The secret that `GET /api/types` asks for; created the first time it is needed. */
	token(): ResultAsync<
		string,
		ServiceError<5000, 'GET_SETTING_FAILED'> | ServiceError<5001, 'SET_SETTING_FAILED'>
	> {
		return this.services
			.settings()
			.get('types_token')
			.andThen((token) => (token ? okAsync(token) : this.regenerateToken()));
	}

	/** Replaces the token, so URLs with the old one stop working. */
	regenerateToken(): ResultAsync<string, ServiceError<5001, 'SET_SETTING_FAILED'>> {
		const token = generateToken();

		return this.services
			.settings()
			.set('types_token', token)
			.map(() => token);
	}

	/** Whether `token` is the current token. There is none until an admin opens the types page. */
	verifyToken(
		token: string
	): ResultAsync<
		boolean,
		ServiceError<5000, 'GET_SETTING_FAILED'> | ServiceError<17002, 'VERIFY_TOKEN_FAILED'>
	> {
		return this.services
			.settings()
			.get('types_token')
			.andThen((current) => {
				if (!current) {
					return okAsync(false);
				}

				// Compares hashes, so the time it takes says nothing about the token.
				return fromPromise(Promise.all([hashToken(token), hashToken(current)]), (error) =>
					this.error(17002, 'VERIFY_TOKEN_FAILED', error)
				).map(([given, expected]) => given === expected);
			});
	}
}
