import type { FieldInfo } from '@pouchbasejs/plugin-sdk/ui';

/**
 * What the plugin contributes, in one place: `field.ts` takes its label and description from here,
 * and the pages use it to describe and try out the field types and routes. Import it as
 * `../lib/catalog.js` from a page, its name in the bundle.
 */

export type FieldTypeId = 'color' | 'phone' | 'rating';

export type FieldTypeInfo = {
	type: FieldTypeId;
	label: string;
	description: string;
	/** Storage class of the column, as `defineField` declares it. */
	column: 'TEXT' | 'INTEGER';
	/** Values the pages show in the type's preview. */
	samples: (string | number)[];
};

export const FIELD_TYPES = {
	color: {
		type: 'color',
		label: 'Color',
		description: 'A hex color, such as #ff8800.',
		column: 'TEXT',
		samples: ['#f97316', '#6366f1', '#14b8a6']
	},
	phone: {
		type: 'phone',
		label: 'Phone number',
		description: 'An international phone number, such as +31 6 12345678.',
		column: 'TEXT',
		samples: ['+31612345678', '+15551234567']
	},
	rating: {
		type: 'rating',
		label: 'Rating',
		description: 'A whole number of stars, from 1 to 5.',
		column: 'INTEGER',
		samples: [5, 3]
	}
} satisfies Record<FieldTypeId, FieldTypeInfo>;

export const FIELD_TYPE_LIST: FieldTypeInfo[] = Object.values(FIELD_TYPES);

export type PageInfo = { path: string; title: string; description: string };

/** The pages, by their path below `/plugins/demo/`. */
export const PAGES: PageInfo[] = [
	{ path: 'overview', title: 'Demo', description: 'This page: what the plugin adds.' },
	{
		path: 'fields',
		title: 'Field playground',
		description: 'Every field type: its input, its preview and what Pouchbase stores.'
	},
	{
		path: 'api',
		title: 'API explorer',
		description: 'Every route of the plugin: send a request and read the response.'
	}
];

/** Where a page of the plugin lives in the dashboard. */
export function pageHref(path: string) {
	return `/plugins/demo/${path}`;
}

export type Method = 'GET' | 'POST';

export type RouteInfo = {
	method: Method;
	/** As the route file declares it, e.g. `/items/:id`. */
	path: string;
	description: string;
	/** The file that answers it, below `routes/`; plugin.ts maps the path to it. */
	file: string;
};

export const ROUTES: RouteInfo[] = [
	{
		method: 'GET',
		path: '/info',
		description: 'Who the plugin is, its settings, and whether an admin asked.',
		file: 'info.ts'
	},
	{
		method: 'POST',
		path: '/echo',
		description: 'Reads a JSON body and answers it, limited and shouted by the settings.',
		file: 'echo.ts'
	},
	{
		method: 'GET',
		path: '/items/:id',
		description: 'A :id segment in the path, read from ctx.params.',
		file: 'item.ts'
	},
	{
		method: 'GET',
		path: '/me',
		description: 'The app user of the bearer token, from ctx.user.',
		file: 'me.ts'
	},
	{
		method: 'GET',
		path: '/notes',
		description: "The user's notes, from the plugin's own collection through ctx.pouch.",
		file: 'notes.ts'
	},
	{
		method: 'POST',
		path: '/notes',
		description: 'Adds a note of the user to the demo_notes collection.',
		file: 'notes.ts'
	},
	{
		method: 'GET',
		path: '/github-status',
		description: 'Calls an outside API, allowed by permissions.network.',
		file: 'github-status.ts'
	}
];

/** Where the routes are served, below the Pouchbase URL. */
export const API_BASE = '/api/plugins/demo';

/** The `field` prop Pouchbase gives a field type's components, for a field named `name`. */
export function fieldInfo(type: FieldTypeId, name: string = type): FieldInfo {
	return { name, type: `demo:${type}`, required: false, options: {} };
}
