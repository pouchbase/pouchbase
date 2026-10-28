import type { Collection } from '#lib/server/services/collections.service.js';
import type { Field } from '#lib/server/services/fields.service.js';
import type { SendableMailTemplate } from '#lib/server/services/mail-templates.service.js';
import type { PluginFieldTypeLike } from './field-type-info';

import { fieldTypeInfo } from './field-type-info';
import { isAutoType, isMultiple, isRelationType } from './field-types';
import { fieldValueType } from './value-types';

/**
 * TypeScript declarations of the collections and the email templates, as `GET /api/types` and the
 * API types page serve them. Pure: give it the rows, get the source text.
 */

/** What the declarations need to know of the plugin field types. */
export type PluginTypes = {
	/** The installed plugin field types, for their labels. */
	installed: readonly PluginFieldTypeLike[];
	/** Ids of the installed types whose plugin deserializes the stored values (or may). */
	deserializes: ReadonlySet<string>;
};

/** `blog_posts` → `BlogPosts`. */
function pascalCase(collection: string) {
	return collection
		.split('_')
		.filter(Boolean)
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join('');
}

/** `note`, and for a hidden field who gets and sets it. */
function withHiddenNote(field: Field, note: string | undefined) {
	return field.hidden
		? [note, 'Hidden: only admins and API keys read and write it.'].filter(Boolean).join(' ')
		: note;
}

/** A JSDoc comment, safe for any text. */
function docComment(text: string, indent: string) {
	return `${indent}/** ${text.replace(/\*\//g, '* /')} */`;
}

/** A JSDoc comment for a field. */
function fieldDoc(field: Field, note: string | undefined, pluginTypes: PluginTypes) {
	const label = fieldTypeInfo(field, pluginTypes.installed).label;
	const doc = [`\`${field.name}\` · ${label}${field.required ? ', required' : ''}.`, note]
		.filter(Boolean)
		.join(' ');

	return docComment(doc, '\t');
}

/** A property name, quoted when it isn't an identifier (`welcome-email`). */
function propertyName(name: string) {
	return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

/**
 * `MailTemplates`: every template `pouch.mail.send()` can send, by name, with its variables.
 * Required variables are required properties; their values are `unknown`, since a template only
 * says where a value goes, not what it is.
 */
function mailTemplateDeclarations(templates: SendableMailTemplate[]) {
	const entries = templates.flatMap((template) => {
		const name = propertyName(template.name);
		const description = template.description ? [docComment(template.description, '\t')] : [];

		if (!template.variables) {
			return [
				...description,
				`\t// The template has errors; fix it on the Mail page.`,
				`\t${name}: Record<string, unknown>;`
			];
		}

		if (!template.variables.length) {
			return [...description, `\t${name}: Record<string, never>;`];
		}

		return [
			...description,
			`\t${name}: {`,
			...template.variables.flatMap((variable) => [
				docComment(`\`${variable.name}\`${variable.required ? ', required' : ''}.`, '\t\t'),
				`\t\t${propertyName(variable.name)}${variable.required ? '' : '?'}: unknown;`
			]),
			'\t};'
		];
	});

	return [
		'/**',
		' * Every email template that `pouch.mail.send()` can send, by name, with its variables:',
		' * `createClient<Schema, MailTemplates>(url)`.',
		' */',
		'export interface MailTemplates {',
		...entries,
		'}'
	].join('\n');
}

/** Interface names per collection: `PascalCase`, with a number when two collections clash. */
function interfaceNames(list: Collection[]) {
	const used = new Set<string>();

	return list.map((collection) => {
		const base = pascalCase(collection.name);
		let name = base;

		for (let suffix = 2; used.has(name); suffix++) {
			name = `${base}${suffix}`;
		}

		used.add(name);

		return name;
	});
}

/**
 * TypeScript declarations for every collection, matching the records API:
 *
 * - `<Name>Record`: a record as the API returns it. Fields that are required or filled in by
 *   Pouchbase are not nullable; multiple relations, files and lists are arrays. Hidden fields are
 *   optional: only admins and API keys get them.
 * - `<Name>Create`: what to send to create one. Fields Pouchbase fills in (id, timestamps,
 *   computed fields) are left out; required fields without a default are required.
 * - `Schema`: both per collection, for the SDK: `createClient<Schema>(url)`.
 * - `Collections`: the record type per collection.
 * - `MailTemplates`: the variables per email template (`mailTemplateDeclarations()`).
 */
export function declarations(
	list: Collection[],
	all: Field[],
	pluginTypes: PluginTypes,
	templates: SendableMailTemplate[]
) {
	const collectionNames = new Map(list.map((collection) => [collection.id, collection.name]));
	const names = interfaceNames(list);
	const target = (field: Field) =>
		field.options.collectionId ? collectionNames.get(field.options.collectionId) : undefined;
	const valueType = (field: Field) =>
		fieldValueType(field, target(field), {
			deserializes: pluginTypes.deserializes.has(field.type)
		});

	const interfaces = list.map((collection, index) => {
		// The records API leaves blobs out.
		const own = all.filter(
			(field) => field.collectionId === collection.id && field.type !== 'blob'
		);

		const record = own.flatMap((field) => {
			const value = valueType(field);
			const filled = isAutoType(field.type);
			const nullable = !filled && !field.required && !isMultiple(field);

			return [
				fieldDoc(field, withHiddenNote(field, value.note), pluginTypes),
				`\t${field.name}${field.hidden ? '?' : ''}: ${value.type}${nullable ? ' | null' : ''};`
			];
		});

		const create = own
			.filter((field) => !isAutoType(field.type) && field.type !== 'computed')
			.flatMap((field) => {
				const value = valueType(field);
				// Only API keys may send a hidden field.
				const optional = !field.required || !!field.defaultValue || field.hidden;
				// Dates may also be sent as a `Date`; it is sent as ISO 8601 text.
				const type = field.type === 'date' ? `${value.type} | Date` : value.type;

				return [
					fieldDoc(field, withHiddenNote(field, value.note), pluginTypes),
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
				' * Types of the collections and email templates, generated by Pouchbase.',
				' * Generate them again after changing a collection or a template; edits to this file are',
				' * overwritten.',
				' */'
			].join('\n'),
			json,
			...interfaces,
			schema,
			map,
			mailTemplateDeclarations(templates)
		].join('\n\n') + '\n'
	);
}
