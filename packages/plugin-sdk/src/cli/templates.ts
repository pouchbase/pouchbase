import type { FieldContribution, PageContribution, PluginSettingType } from '../manifest.js';

import { MANIFEST_FILE, MANIFEST_SCHEMA_URL } from '../manifest.js';

/** The files `init` and `add` write: path → contents. */

export type Files = Record<string, string>;

/** Starting points for `pouchbase-plugin init --template <name>`. */
export const TEMPLATES = ['field', 'page', 'auth-provider', 'empty'] as const;

export type PluginTemplate = (typeof TEMPLATES)[number];

export const TEMPLATE_DESCRIPTIONS: Record<PluginTemplate, string> = {
	field: 'A color field type with validation on the server',
	page: 'A dashboard page that calls a route of the plugin',
	'auth-provider': 'A sign-in provider for an OpenID Connect provider',
	empty: 'Only the manifest and an icon'
};

export function isTemplate(value: string): value is PluginTemplate {
	return (TEMPLATES as readonly string[]).includes(value);
}

/** `color-picker` → `Color picker`, `rich_color` → `Rich color`, `reports/monthly` → `Monthly`. */
export function title(id: string) {
	const words = (id.split('/').at(-1) ?? id).split(/[-_]/).join(' ');

	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `rich_color` → `rich-color`, `reports/monthly` → `reports-monthly`: a file name. */
function fileName(id: string) {
	return id.replace(/[_/]/g, '-');
}

/** JSON as the templates write it: tab-indented, with a final newline. */
export function json(value: unknown) {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

/** The provider id for a plugin id: `auth-acme` → `acme`. */
export function providerIdFor(pluginId: string) {
	return pluginId.replace(/^auth-(?=.)/, '');
}

// Legacy layout: `add` in a project whose manifest has `contributes`

// Fields

/** A field contribution with a text input and a preview, and its components. */
export function fieldFiles(type: string): { contribution: FieldContribution; files: Files } {
	const input = `ui/${fileName(type)}-input.svelte`;
	const preview = `ui/${fileName(type)}-preview.svelte`;

	return {
		contribution: {
			type,
			label: title(type),
			description: `A ${title(type).toLowerCase()} value.`,
			column: 'TEXT',
			input,
			preview
		},
		files: {
			[input]: `<script lang="ts">
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
`,
			[preview]: `<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';

	let { value }: FieldPreviewProps<string> = $props();
</script>

{value ?? ''}
`
		}
	};
}

// Pages

/** A page contribution and its component. */
export function pageFiles(path: string): {
	contribution: Pick<PageContribution, 'path' | 'title' | 'component'>;
	files: Files;
} {
	const component = `ui/${fileName(path)}-page.svelte`;

	return {
		contribution: { path, title: title(path), component },
		files: {
			[component]: `<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	let { params }: PageProps = $props();
</script>

<h1>${title(path)}</h1>

<p>Path below the page: /{params.join('/')}</p>
`
		}
	};
}

// Auth providers

/** Example endpoints of the provider that the templates use; the author replaces them. */
export const EXAMPLE_PROVIDER_HOST = 'id.example.com';

/** Path of a provider's icon, e.g. `ui/acme.svg`. */
export function providerIconPath(id: string) {
	return `ui/${id}.svg`;
}

/** A placeholder icon for the sign-in button; the author replaces it with the provider's logo. */
export const PROVIDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
`;

/** The server entry with one OpenID Connect provider. */
export function authProviderServer(id: string) {
	return `import { createOidcProvider, definePlugin } from '@pouchbasejs/plugin-sdk/server';

/**
 * Replace the URLs with those of your provider, and its host in permissions.network in
 * ${MANIFEST_FILE}. For a provider without OpenID Connect, write the handler yourself:
 *
 *   import { defineAuthProvider, fetchJson } from '@pouchbasejs/plugin-sdk/server';
 *
 *   const provider = defineAuthProvider({
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
const ${camelCase(id)} = createOidcProvider({
	authorizeUrl: 'https://${EXAMPLE_PROVIDER_HOST}/oauth/authorize',
	tokenUrl: 'https://${EXAMPLE_PROVIDER_HOST}/oauth/token',
	userinfoUrl: 'https://${EXAMPLE_PROVIDER_HOST}/oauth/userinfo'
});

export default definePlugin({
	authProviders: {
		${objectKey(id)}: ${camelCase(id)}
	}
});
`;
}

/** `my-sso` → `mySso`. */
function camelCase(id: string) {
	return id.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

/** `acme` → `acme`, `my-sso` → `'my-sso'`. */
export function objectKey(id: string) {
	return /^[a-z_$][\w$]*$/i.test(id) ? id : `'${id}'`;
}

// Convention layout

/** The input of a field type in the convention layout, `fields/<type>/input.svelte`. */
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

/**
 * The preview of a field type in the convention layout, `fields/<type>/preview.svelte`: shows the
 * value, read-only, in the records grid.
 */
const TEXT_PREVIEW = `<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';

	let { value }: FieldPreviewProps<string> = $props();
</script>

{value ?? ''}
`;

/** `fields/<type>/{field.ts,input.svelte,preview.svelte}`: a text field type. */
export function conventionFieldFiles(type: string): Files {
	const dir = `fields/${type}`;

	return {
		[`${dir}/field.ts`]: `import { defineField } from '@pouchbasejs/plugin-sdk/server';

/**
 * The ${type} field type: its name in the dashboard, the column that stores it, and how the server
 * checks and converts values. validate, serialize and deserialize are optional.
 */
export default defineField({
	label: '${title(type)}',
	description: 'A ${title(type).toLowerCase()} value.',
	column: 'TEXT',
	// An Iconify name (https://icon-sets.iconify.design), or the path of an .svg file.
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
	};
}

/** The `field` template: a color field type. */
function colorFieldConventionFiles(): Files {
	return {
		'fields/color/field.ts': `import { defineField } from '@pouchbasejs/plugin-sdk/server';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The color field type: a hex code in a TEXT column, checked and lowercased on the server. */
export default defineField({
	label: 'Color',
	description: 'A color as a hex code, e.g. #ff6600.',
	column: 'TEXT',
	// An Iconify name (https://icon-sets.iconify.design), or the path of an .svg file.
	icon: 'lucide:palette',
	validate(value) {
		return typeof value === 'string' && HEX_COLOR.test(value)
			? { valid: true }
			: { valid: false, message: 'Enter a color, e.g. #ff6600' };
	},
	serialize(value) {
		return String(value).toLowerCase();
	}
});
`,
		'fields/color/input.svelte': `<script lang="ts">
	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';

	let { name, value, required, disabled, id, errorId }: FieldInputProps<string> = $props();
</script>

<input
	type="color"
	{id}
	{name}
	value={value ?? '#000000'}
	{required}
	{disabled}
	aria-describedby={errorId}
/>
`,
		'fields/color/preview.svelte': `<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';

	let { value }: FieldPreviewProps<string> = $props();
</script>

<!-- Tailwind classes work in every component, with the dashboard's design tokens. -->
<span class="inline-flex items-center gap-1.5">
	<span class="size-3 rounded-full inset-ring inset-ring-black/10" style:background={value}></span>
	{value}
</span>
`
	};
}

/** `pages/<path>.svelte`: a page with its title in `<script module>`. */
export function conventionPageFiles(path: string): Files {
	return {
		[`pages/${path}.svelte`]: `<script module lang="ts">
	import type { PageMeta } from '@pouchbasejs/plugin-sdk/ui';

	// A literal object: the CLI reads it without running the component.
	export const page = { title: '${title(path)}', icon: 'lucide:file-text' } satisfies PageMeta;
</script>

<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	let { params }: PageProps = $props();
</script>

<h1>${title(path)}</h1>

<p>Path below the page: /{params.join('/')}</p>
`
	};
}

/** The `page` template: a page that shows what its `GET /hello` route returns. */
function helloPageConventionFiles(pluginId: string): Files {
	return {
		'pages/hello.svelte': `<script module lang="ts">
	import type { PageMeta } from '@pouchbasejs/plugin-sdk/ui';

	export const page = { title: 'Hello', icon: 'lucide:hand' } satisfies PageMeta;
</script>

<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Button from '@pouchbasejs/ui/button';

	let { api }: PageProps = $props();

	async function hello() {
		const response = await api.fetch('/hello');

		if (!response.ok) {
			throw new Error(\`The route answered \${response.status}\`);
		}

		const body = (await response.json()) as { message: string };

		return body.message;
	}

	let message = $state(hello());
</script>

<h1>Hello</h1>

{#await message}
	<p>Loading…</p>
{:then text}
	<p>{text}</p>
{:catch error}
	<p>{error.message}</p>
{/await}

<!-- Components from @pouchbasejs/ui look like the rest of the dashboard. -->
<Button.Root variant="secondary" onclick={() => (message = hello())}>Ask again</Button.Root>
`,
		'routes/hello.ts': `import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * Served at /api/plugins/${pluginId}/hello; the page calls it with api.fetch('/hello'). The greeting
 * is a setting from plugin.ts, typed: a key it doesn't have is a type error.
 */
export const GET: RouteHandler = async (_request, ctx) => {
	const greeting = await ctx.settings.get('greeting');

	return Response.json({ message: \`\${greeting} from \${ctx.plugin.id} \${ctx.plugin.version}\` });
};
`,
		[PLUGIN_FILE]: pluginFileSource([
			{
				key: 'greeting',
				label: 'Greeting',
				description: 'How the Hello page greets, e.g. Hello or Welcome.',
				type: 'text',
				default: 'Hello'
			}
		])
	};
}

/** `routes/<path>.ts` for a route path such as `/items/:id`, with a `GET` handler. */
export function conventionRouteFiles(file: string, path: string, pluginId: string | null): Files {
	const hasParams = path.includes('/:');
	const url = `/api/plugins/${pluginId ?? '<plugin>'}${path === '/' ? '' : path}`;

	return {
		[file]: `import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

/**
 * GET ${path}, served at ${url}. Export POST, PUT, PATCH or DELETE from this file for the other
 * methods. Routes are public: check ctx.admin (an admin in the dashboard) or ctx.user (the app
 * user of the request's bearer token) before doing something that needs either.
 */
export const GET: RouteHandler = (_request, ctx) =>
	Response.json({ path: '${path}'${hasParams ? ', params: ctx.params' : ''}, admin: ctx.admin });
`
	};
}

/** `auth/<id>/provider.ts`: an OpenID Connect provider with example URLs. */
export function conventionProviderFile(id: string) {
	return `import { createOidcProvider, defineAuthProvider } from '@pouchbasejs/plugin-sdk/server';

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
	// The name on the sign-in button, and where an admin registers the OAuth app.
	label: '${title(id)}',
	consoleUrl: 'https://${EXAMPLE_PROVIDER_HOST}/apps'
});
`;
}

/** `auth/<id>/{provider.ts,icon.svg}`. */
export function conventionProviderFiles(id: string): Files {
	return {
		[`auth/${id}/provider.ts`]: conventionProviderFile(id),
		[`auth/${id}/icon.svg`]: PROVIDER_ICON
	};
}

// Settings

/** The root file that holds the settings in the convention layout. */
export const PLUGIN_FILE = 'plugin.ts';

/** A setting as `add setting` and the templates write it. */
export type SettingTemplate = {
	key: string;
	label: string;
	description?: string;
	type: PluginSettingType;
	default?: string | number | boolean;
};

/** `it's` → `'it\'s'`: a single-quoted string literal. */
function quote(value: string) {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** A setting as an object literal; `indent` is the indentation of its braces. */
export function settingSource(setting: SettingTemplate, indent = '\t\t') {
	const lines = [
		`key: ${quote(setting.key)}`,
		`label: ${quote(setting.label)}`,
		...(setting.description !== undefined ? [`description: ${quote(setting.description)}`] : []),
		`type: ${quote(setting.type)}`,
		...(setting.default === undefined
			? []
			: [
					`default: ${typeof setting.default === 'string' ? quote(setting.default) : String(setting.default)}`
				])
	];

	return `{\n${lines.map((line) => `${indent}\t${line}`).join(',\n')}\n${indent}}`;
}

/**
 * `plugin.ts` with `settings`, and the `Register` block that types `ctx.settings.get(key)` in the
 * routes, field types and auth providers of the plugin.
 */
export function pluginFileSource(settings: readonly SettingTemplate[]) {
	const list = settings.length
		? `[\n${settings.map((setting) => `\t\t${settingSource(setting)}`).join(',\n')}\n\t]`
		: '[]';

	return `import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

/**
 * The plugin's settings: an admin fills them in on the Plugins page, and the server code reads them
 * with \`await ctx.settings.get(key)\`. A number setting comes back as a number, a boolean setting
 * as a boolean, the others as strings; \`null\` while there is no value, unless the setting has a
 * default (a required setting without one is \`null\` until an admin saves it). Add one with
 * \`pouchbase-plugin add setting <key>\`.
 */
const plugin = definePlugin({
	settings: ${list}
});

export default plugin;

// Types ctx.settings.get(key) everywhere in the plugin, from the settings above.
declare module '@pouchbasejs/plugin-sdk/server' {
	interface Register {
		plugin: typeof plugin;
	}
}
`;
}

// Tests

/** The test of the `field` template: the color field type's server code. */
const COLOR_TEST = `import type { FieldTypeHandler } from '@pouchbasejs/plugin-sdk/server';

import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import field from '../fields/color/field.js';

// Called the way Pouchbase calls it: with the field's options and the plugin context.
const color: FieldTypeHandler = field;

describe('the color field type', () => {
	const { ctx } = fakeContext();

	it('accepts hex colors and stores them lowercased', async () => {
		expect(await color.validate?.('#FF6600', {}, ctx)).toEqual({ valid: true });
		expect(await color.serialize?.('#FF6600', ctx)).toBe('#ff6600');
	});

	it('refuses anything else', async () => {
		expect(await color.validate?.('orange', {}, ctx)).toEqual({
			valid: false,
			message: 'Enter a color, e.g. #ff6600'
		});
	});
});
`;

/** The test of the `page` template: its route, with the greeting setting. */
function helloTest(pluginId: string) {
	return `import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import plugin from '../plugin.js';
import manifest from '../pouchbase-plugin.json' with { type: 'json' };
import { GET } from '../routes/hello.js';

const request = new Request('https://pouchbase.test/api/plugins/${pluginId}/hello');

describe('GET /hello', () => {
	it('greets with the default greeting', async () => {
		const { ctx } = fakeContext({ manifest, plugin });
		const response = await GET(request, ctx);

		expect(await response.json()).toEqual({ message: 'Hello from ${pluginId} 0.1.0' });
	});

	it('greets with the greeting an admin saved', async () => {
		// Settings are the strings the host stores, typed by the keys in plugin.ts.
		const { ctx } = fakeContext({ manifest, plugin, settings: { greeting: 'Welcome' } });
		const response = await GET(request, ctx);

		expect(await response.json()).toEqual({ message: 'Welcome from ${pluginId} 0.1.0' });
	});
});
`;
}

/** The test of the `auth-provider` template: the profile from the userinfo endpoint. */
function providerTest(id: string) {
	return `import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import provider from '../auth/${id}/provider.js';
import manifest from '../pouchbase-plugin.json' with { type: 'json' };

const USERINFO = 'https://${EXAMPLE_PROVIDER_HOST}/oauth/userinfo';

describe('the ${id} provider', () => {
	it('maps the userinfo claims to a profile', async () => {
		// ctx.fetch answers from these responses, and only reaches the hosts in permissions.network.
		const { ctx, requests } = fakeContext({
			manifest,
			responses: {
				[USERINFO]: { sub: '42', email: 'ada@example.com', email_verified: true, name: 'Ada' }
			}
		});

		expect(await provider.profile('token', { clientId: 'client' }, ctx)).toEqual({
			id: '42',
			email: 'ada@example.com',
			emailVerified: true,
			name: 'Ada',
			avatarUrl: null
		});
		expect(requests.map((request) => request.url)).toEqual([USERINFO]);
		expect(requests[0]?.headers.get('authorization')).toBe('Bearer token');
	});
});
`;
}

/** The test of the `empty` template: a start, with the network rules of `ctx.fetch`. */
function emptyTest(pluginId: string) {
	return `import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import manifest from '../pouchbase-plugin.json' with { type: 'json' };

describe('${pluginId}', () => {
	it('only reaches the hosts in permissions.network', async () => {
		const { ctx } = fakeContext({ manifest });

		await expect(ctx.fetch('https://example.com/')).rejects.toThrow(
			'example.com is not in permissions.network'
		);
	});
});
`;
}

// Projects

/** Path of the plugin's own icon in new projects. */
export const PLUGIN_ICON_PATH = 'icon.svg';

/** A placeholder for the plugin's icon in the marketplace; the author replaces it. */
export const PLUGIN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/></svg>
`;

/** The `@pouchbasejs/ui` versions new plugins are written against. */
export const UI_PACKAGE_RANGE = '^0.2.0';

/** The Pouchbase versions new plugins need: the first with everything the templates use. */
export const POUCHBASE_ENGINE_RANGE = '>=0.10.0';

/** Versions of the test and check tools in new plugins, as the repository uses them. */
const VITEST_RANGE = '^5.0.5';
const SVELTE_CHECK_RANGE = '^4.7.7';

/**
 * What the `tsconfig.json` of a new plugin type-checks: the convention folders, `lib/` and
 * `plugin.ts` (whose `Register` block types `ctx.settings`).
 */
export const SOURCE_DIRS = ['fields', 'pages', 'auth', 'routes', 'lib', PLUGIN_FILE] as const;

function readme(name: string) {
	return `# ${name}

A [Pouchbase](https://pouchbase.io) plugin. Its folders say what it adds:

- \`fields/<type>/\`: a field type (\`field.ts\`, \`input.svelte\`, \`preview.svelte\`);
- \`pages/<path>.svelte\`: a dashboard page at \`/plugins/<id>/<path>\`;
- \`auth/<id>/\`: a sign-in provider (\`provider.ts\`, \`icon.svg\`);
- \`routes/<path>.ts\`: routes at \`/api/plugins/<id>/<path>\` (\`export const GET\`, \`POST\`, …);
- \`lib/\`: code shared by the rest;
- \`plugin.ts\`: the settings an admin fills in on the Plugins page (\`definePlugin({ settings })\`),
  read with \`await ctx.settings.get(key)\`.

Scripts:

- \`pnpm dev\` builds the plugin on every change and serves it from a local registry; start
  Pouchbase with the \`POUCHBASE_REGISTRY_URL\` it prints and install the plugin on the Plugins page.
- \`pnpm validate\` checks the plugin and compiles its components like Pouchbase does on install;
  \`npx pouchbase-plugin manifest\` prints the manifest it generates.
- \`pnpm test\` runs the tests in \`test/\` (vitest, with \`fakeContext\` from
  \`@pouchbasejs/plugin-sdk/testing\`); \`pnpm check\` type-checks the code and the components.
- \`pnpm build\` writes the bundle to \`dist/\`.
- \`pnpm release\` publishes it to the registry (needs \`POUCHBASE_REGISTRY_TOKEN\`).
- \`npx pouchbase-plugin add field|page|auth-provider|route <id>\` adds the files of a contribution;
  \`npx pouchbase-plugin add setting <key> [--type text|secret|number|boolean|url]\` adds a setting
  to \`plugin.ts\`.

The version lives in \`package.json\`; the manifest takes it from there.
`;
}

/**
 * Every file of a new plugin, in the convention layout. The manifest has a human `name` and no
 * `version`: `version`, `description` and `license` come from `package.json`, so a release only
 * bumps one file.
 */
export function projectFiles(id: string, template: PluginTemplate, sdkVersion: string): Files {
	const name = title(id);
	const manifest: Record<string, unknown> = { $schema: MANIFEST_SCHEMA_URL, id, name };
	let tests: Files = { 'test/plugin.test.ts': emptyTest(id) };
	let description = 'A Pouchbase plugin.';
	let files: Files = {};

	switch (template) {
		case 'field':
			description = 'Adds a color field type.';
			manifest.categories = ['fields'];
			files = colorFieldConventionFiles();
			tests = { 'test/color.test.ts': COLOR_TEST };
			break;

		case 'page':
			description = 'Adds a page to the dashboard.';
			manifest.categories = ['pages'];
			files = helloPageConventionFiles(id);
			tests = { 'test/hello.test.ts': helloTest(id) };
			break;

		case 'auth-provider': {
			const provider = providerIdFor(id);

			manifest.name = `${title(provider)} sign-in`;
			description = `Sign in with ${title(provider)}.`;
			manifest.categories = ['auth'];
			manifest.permissions = { network: [EXAMPLE_PROVIDER_HOST] };
			files = conventionProviderFiles(provider);
			tests = { 'test/provider.test.ts': providerTest(provider) };
			break;
		}

		case 'empty':
			break;
	}

	manifest.engines = { pouchbase: POUCHBASE_ENGINE_RANGE };

	return {
		[MANIFEST_FILE]: json(manifest),
		[PLUGIN_ICON_PATH]: PLUGIN_ICON,
		'package.json': json({
			name: id,
			version: '0.1.0',
			private: true,
			description,
			license: 'MIT',
			type: 'module',
			scripts: {
				dev: 'pouchbase-plugin dev',
				check: 'svelte-check --tsconfig ./tsconfig.json',
				test: 'vitest run',
				validate: 'pouchbase-plugin validate',
				build: 'pouchbase-plugin build',
				release: 'pouchbase-plugin publish'
			},
			devDependencies: {
				'@pouchbasejs/plugin-sdk': `^${sdkVersion}`,
				// Types only: the host provides the components at runtime.
				'@pouchbasejs/ui': UI_PACKAGE_RANGE,
				svelte: '^5.0.0',
				'svelte-check': SVELTE_CHECK_RANGE,
				typescript: '^6.0.0',
				vitest: VITEST_RANGE
			}
		}),
		'tsconfig.json': json({
			compilerOptions: {
				target: 'ES2022',
				module: 'ESNext',
				moduleResolution: 'Bundler',
				lib: ['ES2022', 'DOM'],
				strict: true,
				verbatimModuleSyntax: true,
				skipLibCheck: true,
				resolveJsonModule: true,
				noEmit: true
			},
			include: [...SOURCE_DIRS, 'test']
		}),
		'.gitignore': 'node_modules\ndist\n',
		'README.md': readme(name),
		...files,
		...tests
	};
}
