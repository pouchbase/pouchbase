import { MANIFEST_FILE } from '../../manifest.js';
import { objectKey, quote, title, type Files } from './source.js';

/** The contributions `add` creates, one kind at a time, and the templates start with. */

/** Example endpoints of the provider that the templates use; the author replaces them. */
export const EXAMPLE_PROVIDER_HOST = 'id.example.com';

/** A placeholder icon for the sign-in button; the author replaces it with the provider's logo. */
const PROVIDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
`;

/**
 * A contribution to add to `definePlugin({ ... })`: the files it lives in, the entry of its record
 * and the imports that entry needs.
 */
export type PluginEntry = {
	key: 'fields' | 'pages' | 'authProviders' | 'routes' | 'functions';
	/** Its id: the key in the record. */
	id: string;
	/** The value's source, e.g. `color` or `{ title: 'Stats', component: Stats }`. */
	value: string;
	/** Import statements of `plugin.ts`, e.g. `import color from './fields/color/field.js';`. */
	imports: string[];
	files: Files;
};

/** `color` → `color`, `{ ... }` → `'my-page': { ... }`: an entry of a record. */
export function entrySource(entry: Pick<PluginEntry, 'id' | 'value'>) {
	return entry.value === entry.id ? entry.id : `${objectKey(entry.id)}: ${entry.value}`;
}

/** The input of a field type, `input.svelte`. */
const TEXT_INPUT = `<script lang="ts">
	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';

	let { name, value, required, disabled, id, errorId }: FieldInputProps<string> = $props();
</script>

<input
	type="text"
	{id}
	{name}
	value={value ?? ''}
	{required}
	{disabled}
	aria-describedby={errorId}
/>
`;

/** The preview of a field type, `preview.svelte`: shows the value, read-only, in the records grid. */
const TEXT_PREVIEW = `<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';

	let { value }: FieldPreviewProps<string> = $props();
</script>

{value ?? ''}
`;

/** A text field type in `fields/<type>/`, `name` the import in `plugin.ts`. */
export function fieldEntry(type: string, name: string): PluginEntry {
	const dir = `fields/${type}`;

	return {
		key: 'fields',
		id: type,
		value: name,
		imports: [`import ${name} from './${dir}/field.js';`],
		files: {
			[`${dir}/field.ts`]: `import { defineField } from '@pouchbasejs/plugin-sdk/server';

import Input from './input.svelte';
import Preview from './preview.svelte';

/**
 * The ${type} field type: its name in the dashboard, the column that stores it, its components and
 * how the server checks and converts values. preview, icon, validate, serialize and deserialize
 * are optional.
 */
export default defineField({
	label: '${title(type)}',
	description: 'A ${title(type).toLowerCase()} value.',
	column: 'TEXT',
	input: Input,
	preview: Preview,
	// An Iconify name (https://icon-sets.iconify.design), or an imported .svg file.
	icon: 'lucide:text-cursor-input',
	validate(value) {
		return typeof value === 'string' && value.length <= 200
			? { valid: true }
			: { valid: false, message: 'Enter at most 200 characters' };
	}
});
`,
			[`${dir}/input.svelte`]: TEXT_INPUT,
			[`${dir}/preview.svelte`]: TEXT_PREVIEW
		}
	};
}

/** A page at `path`, in `pages/<path>.svelte`; `name` the import in `plugin.ts`. */
export function pageEntry(path: string, name: string): PluginEntry {
	return {
		key: 'pages',
		id: path,
		value: `{\n\ttitle: ${quote(title(path))},\n\ticon: 'lucide:file-text',\n\tcomponent: ${name}\n}`,
		imports: [`import ${name} from './pages/${path}.svelte';`],
		files: {
			[`pages/${path}.svelte`]: `<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	let { params }: PageProps = $props();
</script>

<h1>${title(path)}</h1>

<p>Path below the page: /{params.join('/')}</p>
`
		}
	};
}

/**
 * Routes at `path` (such as `/items/:id`) in `file`, with a `GET` handler; `name` the import in
 * `plugin.ts`.
 */
export function routeEntry(
	path: string,
	file: string,
	name: string,
	pluginId: string | null
): PluginEntry {
	const hasParams = path.includes('/:');
	const url = `/api/plugins/${pluginId ?? '<plugin>'}${path === '/' ? '' : path}`;

	return {
		key: 'routes',
		id: path,
		value: name,
		imports: [`import * as ${name} from './${file.replace(/\.ts$/, '.js')}';`],
		files: {
			[file]: `import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * GET ${path}, served at ${url}. Export POST, PUT, PATCH or DELETE as well for the other methods.
 * Routes are public: check ctx.admin (an admin in the dashboard) or ctx.user (the app user of the
 * request's bearer token) before doing something that needs either.
 */
export const GET: RouteHandler = (_request, ctx) =>
	Response.json({ path: '${path}'${hasParams ? ', params: ctx.params' : ''}, admin: ctx.admin });
`
		}
	};
}

/** A function in `functions/<name>.ts`; `variable` the import in `plugin.ts`. */
export function functionEntry(
	name: string,
	variable: string,
	pluginId: string | null
): PluginEntry {
	const url = `/api/functions/${pluginId ?? '<plugin>'}-${name}`;

	return {
		key: 'functions',
		id: name,
		value: variable,
		imports: [`import ${variable} from './functions/${name}.js';`],
		files: {
			[`functions/${name}.ts`]: `import { defineFunction } from '@pouchbasejs/plugin-sdk/server';

/**
 * Served at ${url}, for every method; apps call it with pouch.functions.invoke(). Without
 * requireAuth anyone may call it: check ctx.user (the app user of the request's bearer token)
 * before doing something that needs one.
 */
export default defineFunction({
	description: ${quote(`${title(name)}.`)},
	requireAuth: false,
	handler: (_request, ctx) => Response.json({ user: ctx.user?.id ?? null })
});
`
		}
	};
}

/** `auth/<id>/provider.ts`: an OpenID Connect provider with example URLs and its logo. */
function providerFile(id: string) {
	return `import { createOidcProvider, defineAuthProvider } from '@pouchbasejs/plugin-sdk/server';

import logo from './icon.svg';

/**
 * Replace the URLs with those of your provider, and its host in permissions.network in
 * ${MANIFEST_FILE}. For a provider without OpenID Connect, write the handler yourself:
 *
 *   import { defineAuthProvider, fetchJson } from '@pouchbasejs/plugin-sdk/server';
 *
 *   export default defineAuthProvider({
 *   	label: '${title(id)}',
 *   	authorizeUrl: 'https://${EXAMPLE_PROVIDER_HOST}/oauth/authorize',
 *   	tokenUrl: 'https://${EXAMPLE_PROVIDER_HOST}/oauth/token',
 *   	scopes: ['read:user'],
 *   	pkce: true,
 *   	async profile(accessToken, credentials, ctx) {
 *   		const user = await fetchJson<{ id: number; email: string }>(
 *   			ctx,
 *   			'https://${EXAMPLE_PROVIDER_HOST}/api/user',
 *   			accessToken
 *   		);
 *
 *   		return {
 *   			id: String(user.id),
 *   			email: user.email,
 *   			emailVerified: false,
 *   			name: null,
 *   			avatarUrl: null
 *   		};
 *   	}
 *   });
 */
export default defineAuthProvider({
	...createOidcProvider({
		authorizeUrl: 'https://${EXAMPLE_PROVIDER_HOST}/oauth/authorize',
		tokenUrl: 'https://${EXAMPLE_PROVIDER_HOST}/oauth/token',
		userinfoUrl: 'https://${EXAMPLE_PROVIDER_HOST}/oauth/userinfo'
	}),
	// The name and logo on the sign-in button, and where an admin registers the OAuth app.
	label: '${title(id)}',
	icon: logo,
	consoleUrl: 'https://${EXAMPLE_PROVIDER_HOST}/apps'
});
`;
}

/** A sign-in provider in `auth/<id>/`, `name` the import in `plugin.ts`. */
export function providerEntry(id: string, name: string): PluginEntry {
	return {
		key: 'authProviders',
		id,
		value: name,
		imports: [`import ${name} from './auth/${id}/provider.js';`],
		files: {
			[`auth/${id}/provider.ts`]: providerFile(id),
			[`auth/${id}/icon.svg`]: PROVIDER_ICON
		}
	};
}
