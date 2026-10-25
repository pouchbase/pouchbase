import type { GridField } from './grid';
import type { ApiRuleAction } from '#lib/filter/rules.js';

import { isAutoType } from '#lib/fields/field-types.js';
import { fieldTypeInfo } from '#lib/fields/field-type-info.js';
import { fieldValueType } from '#lib/fields/value-types.js';
import { apiActions, protectedApiFields } from '#lib/filter/rules.js';

/**
 * Documentation of the records API for one collection, as shown in the API preview: per action
 * the endpoint, its parameters, SDK and cURL examples and example responses, built from the
 * collection's fields.
 */

export type ApiParam = { name: string; type: string; required?: boolean; description: string };

export type ApiExample = {
	action: ApiRuleAction;
	description: string;
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	path: string;
	sdk: string;
	curl: string;
	queryParams: ApiParam[];
	bodyParams: ApiParam[];
	responses: { status: number; description: string; body: string | null }[];
};

type Collection = { name: string; system: boolean };

const EXAMPLE_TIME = Date.UTC(2026, 0, 15, 9, 30);

/** An example of a field's value as the API returns it, and as it is sent. */
function exampleValue(field: GridField): unknown {
	const items = field.options.values ?? [];
	const info = fieldTypeInfo(field);

	// A plugin's type: what fits its column; the plugin decides what is valid.
	if (info.plugin) {
		return info.column === 'INTEGER' || info.column === 'REAL' ? 3 : 'value';
	}

	switch (field.type) {
		case 'id':
			return field.options.generator === 'autoincrement' ? 1 : 'k3x9f2m8q1w7z4p';
		case 'created':
		case 'updated':
			return EXAMPLE_TIME;
		case 'rich_text':
			return field.options.format === 'markdown' ? '**Hello**' : '<p>Hello</p>';
		case 'number':
			return 12.5;
		case 'integer':
			return 42;
		case 'boolean':
			return true;
		case 'date':
			return new Date(EXAMPLE_TIME).toISOString();
		case 'email':
			return 'ada@example.com';
		case 'url':
			return 'https://example.com';
		case 'json':
			return { key: 'value' };
		case 'list':
			return field.options.multiple ? items.slice(0, 2) : (items[0] ?? 'item');
		case 'relation':
		case 'file':
			return field.options.multiple ? ['RECORD_ID_1', 'RECORD_ID_2'] : 'RECORD_ID';
		case 'computed':
			return 'computed value';
		default:
			return 'Hello';
	}
}

/** The type of a value to send for a field. */
function inputType(field: GridField, relationTargets: Record<string, string>) {
	return field.type === 'json'
		? 'any JSON'
		: fieldValueType(field, relationTargets[field.name]).type;
}

/** JSON written as a JavaScript object literal, with unquoted keys where possible. */
function objectLiteral(value: unknown, indent: string) {
	return JSON.stringify(value, null, '\t')
		.replace(/^(\t+)"([a-z_][a-z0-9_]*)":/gm, '$1$2:')
		.replace(/\n/g, `\n${indent}`);
}

function json(value: unknown) {
	return JSON.stringify(value, null, 2);
}

/** The documentation of every action the records API offers for this collection. */
export function apiExamples(
	collection: Collection,
	fields: GridField[],
	relationTargets: Record<string, string>,
	origin: string
): ApiExample[] {
	const readable = fields.filter((field) => field.type !== 'blob');
	const protectedFields = protectedApiFields(collection);
	const writable = readable.filter(
		(field) =>
			!isAutoType(field.type) && field.type !== 'computed' && !protectedFields.includes(field.name)
	);
	const record = Object.fromEntries(readable.map((field) => [field.name, exampleValue(field)]));
	const body = Object.fromEntries(writable.map((field) => [field.name, exampleValue(field)]));
	const required = writable.filter((field) => field.required);
	const created = fields.find((field) => field.type === 'created')?.name;
	const textField = readable.find((field) => field.type === 'text')?.name;
	const order = created ? `${created}:desc` : undefined;
	const where = textField ? `contains(${textField}, "hello")` : undefined;

	const path = `/api/db/${collection.name}`;
	const url = `${origin}${path}`;
	const sdk = `pouch.db.${collection.name}`;
	const setup = [
		`import { createClient } from '@pouchbasejs/js-sdk';`,
		`import type { Schema } from './pouchbase'; // from the Types page`,
		'',
		`const pouch = createClient<Schema>('${origin}');`,
		'',
		''
	].join('\n');
	const auth = `-H "Authorization: Bearer $TOKEN"`;
	const findOptions = [
		textField && `\twhere: { ${textField}: { contains: 'hello' } }`,
		created && `\torderBy: { ${created}: 'desc' }`,
		'\tlimit: 30'
	].filter(Boolean);
	const listQuery = new URLSearchParams({ limit: '30' });

	if (order) {
		listQuery.set('order', order);
	}

	if (where) {
		listQuery.set('where', where);
	}

	const locked = {
		status: 403,
		description: 'The rule is locked.',
		body: json({ message: 'Only admins can do this: the API rule is locked' })
	};
	const notFound = {
		status: 404,
		description: "The record doesn't exist or the rule doesn't match it.",
		body: json({ message: 'Record not found' })
	};
	const invalid = {
		status: 400,
		description: 'Invalid values, with a message per field.',
		body: json({
			message: 'Invalid record',
			issues: { [required[0]?.name ?? writable[0]?.name ?? 'field']: 'Required' }
		})
	};
	const bodyParams = writable.map((field) => ({
		name: field.name,
		type: inputType(field, relationTargets),
		required: field.required,
		description: fieldValueType(field, relationTargets[field.name]).note ?? ''
	}));

	const selectParam = {
		name: 'select',
		type: 'string',
		description: `Only return these fields, separated by commas, e.g. \`${readable
			.slice(0, 2)
			.map((field) => field.name)
			.join(',')}\`.`
	};

	const examples: Record<ApiRuleAction, ApiExample> = {
		list: {
			action: 'list',
			description:
				'One page of records that match `where` and the list rule. Records the rule doesn’t match are left out.',
			method: 'GET',
			path,
			sdk: `${setup}// One page of records, typed by the schema
const { items, total, hasMore } = await ${sdk}.findMany({
${findOptions.join(',\n')}
});

// Only some fields: the result type has only them too
const titles = await ${sdk}.findMany({ select: ['${readable[0]?.name ?? 'id'}'] });

// Every record, fetched page by page as you go
for await (const record of ${sdk}.iterate()) {
	console.log(record);
}

// The first match, or null
const first = await ${sdk}.findFirst({ where: { ${textField ?? 'id'}: 'hello' } });`,
			curl: `curl -G '${url}' \\\n\t${auth} \\\n\t${[...listQuery].map(([key, value]) => `--data-urlencode '${key}=${value.replace(/'/g, "'\\''")}'`).join(' \\\n\t')}`,
			queryParams: [
				{
					name: 'where',
					type: 'string',
					description:
						'A condition in the syntax of the API rules, e.g. `status == "published" and views > 10`.'
				},
				{
					name: 'order',
					type: 'string',
					description:
						'Fields to order by, separated by commas, each with `:asc` (the default) or `:desc`, e.g. `created_at:desc,title`. Defaults to the order of creation.'
				},
				selectParam,
				{
					name: 'limit',
					type: 'number',
					description: 'Records to return, at most 500. Defaults to 30.'
				},
				{
					name: 'offset',
					type: 'number',
					description: 'Matching records to skip first. Defaults to 0.'
				}
			],
			bodyParams: [],
			responses: [
				{
					status: 200,
					description: 'A page of records.',
					body: json({ items: [record], total: 1, limit: 30, offset: 0 })
				},
				{
					status: 400,
					description: 'An invalid `where`, `order`, `select` or `include`.',
					body: json({ message: 'Invalid where: Unknown field `foo`' })
				},
				locked
			]
		},
		view: {
			action: 'view',
			description: 'One record by id, when the view rule matches it.',
			method: 'GET',
			path: `${path}/:id`,
			sdk: `${setup}const record = await ${sdk}.find('RECORD_ID'); // null when not found`,
			curl: `curl '${url}/RECORD_ID' \\\n\t${auth}`,
			queryParams: [selectParam],
			bodyParams: [],
			responses: [{ status: 200, description: 'The record.', body: json(record) }, locked, notFound]
		},
		create: {
			action: 'create',
			description:
				'Creates a record when the create rule matches it. Fields that are left out get their default value; `id` and the timestamps are filled in.',
			method: 'POST',
			path,
			sdk: `${setup}const record = await ${sdk}.insert(${objectLiteral(body, '')});

// Or without try/catch, e.g. to show the issues in a form
const result = await ${sdk}.insert(values).safe();

if (!result.ok) {
	console.log(result.error.issues); // a message per field
}`,
			curl: `curl -X POST '${url}' \\\n\t${auth} \\\n\t-H 'Content-Type: application/json' \\\n\t-d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`,
			queryParams: [selectParam],
			bodyParams,
			responses: [
				{ status: 200, description: 'The new record.', body: json(record) },
				invalid,
				{
					status: 403,
					description: 'The rule is locked or doesn’t match the new record.',
					body: json({ message: 'The create rule of this collection doesn’t allow this record' })
				},
				{
					status: 409,
					description: 'A unique field’s value is taken.',
					body: json({
						message: 'A record with this value already exists',
						issues: { [writable[0]?.name ?? 'field']: 'This value is already in use' }
					})
				}
			]
		},
		update: {
			action: 'update',
			description:
				'Changes the fields in the body of a record, when the update rule matches the stored record. Fields that are left out keep their value.',
			method: 'PATCH',
			path: `${path}/:id`,
			sdk: `${setup}const record = await ${sdk}.patch('RECORD_ID', ${objectLiteral(body, '')});`,
			curl: `curl -X PATCH '${url}/RECORD_ID' \\\n\t${auth} \\\n\t-H 'Content-Type: application/json' \\\n\t-d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`,
			queryParams: [selectParam],
			bodyParams: bodyParams.map((param) => ({ ...param, required: false })),
			responses: [
				{ status: 200, description: 'The updated record.', body: json(record) },
				invalid,
				locked,
				notFound
			]
		},
		delete: {
			action: 'delete',
			description: 'Deletes a record when the delete rule matches it.',
			method: 'DELETE',
			path: `${path}/:id`,
			sdk: `${setup}await ${sdk}.remove('RECORD_ID');`,
			curl: `curl -X DELETE '${url}/RECORD_ID' \\\n\t${auth}`,
			queryParams: [],
			bodyParams: [],
			responses: [{ status: 204, description: 'Deleted; no body.', body: null }, locked, notFound]
		}
	};

	return apiActions(collection).map((action) => examples[action]);
}
