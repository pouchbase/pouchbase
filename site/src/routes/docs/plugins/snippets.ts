import { snippet, type Language } from '#lib/highlight.js';

// Files of the demo plugin (`examples/plugin-demo`) and the built-in GitHub sign-in
// (`plugins/auth-github`), inlined at build time, so the samples that say they come from them are
// always their current code.
import demoPlugin from '../../../../../examples/plugin-demo/plugin.ts?raw';
import demoGithubStatus from '../../../../../examples/plugin-demo/routes/github-status.ts?raw';
import demoInfo from '../../../../../examples/plugin-demo/routes/info.ts?raw';
import demoItem from '../../../../../examples/plugin-demo/routes/item.ts?raw';
import demoMe from '../../../../../examples/plugin-demo/routes/me.ts?raw';
import demoNotesCollection from '../../../../../examples/plugin-demo/collections/notes.ts?raw';
import demoNotes from '../../../../../examples/plugin-demo/routes/notes.ts?raw';
import githubProvider from '../../../../../plugins/auth-github/auth/github/provider.ts?raw';

/** A file of a plugin in the repository as a snippet, with Unix line endings whatever the checkout has. */
function demo(language: Language, source: string) {
	return snippet(language, source.replace(/\r\n/g, '\n'));
}

export const init = snippet(
	'bash',
	`
npx @pouchbasejs/plugin-sdk init color-picker
cd color-picker
pnpm install
pnpm dev`
);

export const templates = snippet(
	'bash',
	`
npx @pouchbasejs/plugin-sdk init my-page --template page
npx @pouchbasejs/plugin-sdk init auth-gitlab --template auth-provider   # creates auth/gitlab/`
);

export const add = snippet(
	'bash',
	`
# Each creates its files and adds the entry, with its import, to definePlugin({ ... }) in plugin.ts
npx pouchbase-plugin add field rating            # fields/rating/field.ts, input.svelte, preview.svelte
npx pouchbase-plugin add page reports/monthly    # pages/reports/monthly.svelte
npx pouchbase-plugin add route items/:id         # routes/items/[id].ts, at '/items/:id'
npx pouchbase-plugin add auth-provider gitlab    # auth/gitlab/provider.ts, auth/gitlab/icon.svg
npx pouchbase-plugin add setting api_key --type secret   # a setting in plugin.ts`
);

export const devRegistry = snippet(
	'bash',
	`
# Server variable of the Pouchbase installation you test with
POUCHBASE_REGISTRY_URL=http://localhost:4510`
);

export const devInRepo = snippet(
	'bash',
	`
# Terminal 1, in the plugin
pnpm dev                                   # the dev registry on http://localhost:4510

# Terminal 2, in a clone of the Pouchbase repository
POUCHBASE_REGISTRY_URL=http://localhost:4510 pnpm dev   # the dashboard on http://localhost:5173`
);

export const layout = snippet(
	'bash',
	`
color-picker/
├── pouchbase-plugin.json        # id, name, permissions, ...: what isn't code
├── package.json                 # version, description, license, author, ...
├── plugin.ts                    # definePlugin({ ... }): everything the plugin adds
├── icon.svg                     # the plugin's icon (optional)
├── tsconfig.json
├── vitest.config.ts
├── fields/
│   └── color/
│       ├── field.ts             # defineField({ label, description, column, input, ... })
│       ├── input.svelte         # edits the value in the record form
│       └── preview.svelte       # shows the value, read-only, in the records grid
├── pages/
│   └── palette.svelte           # a dashboard page
├── auth/
│   └── gitlab/
│       ├── provider.ts          # defineAuthProvider({ ... })
│       └── icon.svg             # the provider's logo
├── collections/
│   └── notes.ts                 # defineCollection({ fields, indexes, rules })
├── routes/
│   ├── stats.ts                 # export const GET, POST, ...
│   └── items/
│       └── [id].ts              # just a file name: the path is its key in plugin.ts
├── lib/                         # code shared by the rest
└── test/`
);

export const pluginFile = demo('typescript', demoPlugin);

export const tsconfig = snippet(
	'json',
	`
{
	"compilerOptions": {
		"types": ["svelte", "@pouchbasejs/plugin-sdk/env"],
		"strict": true
	},
	"include": ["**/*.ts", "**/*.svelte"]
}`
);

export const manifest = snippet(
	'json',
	`
{
	"$schema": "https://pouchbase.io/schemas/plugin-manifest.json",
	"id": "color-picker",
	"name": "Color picker",
	"categories": ["fields", "pages"],
	"engines": { "pouchbase": ">=0.10.0" },
	"permissions": { "network": ["api.example.com"] }
}`
);

/** `collections/notes.ts` of the demo plugin. */
export const notesCollection = demo('typescript', demoNotesCollection);

/** `routes/notes.ts` of the demo plugin. */
export const notesRoute = demo('typescript', demoNotes);

export const collectionsInPlugin = snippet(
	'typescript',
	`
import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import notes from './collections/notes.js';
import * as notesRoute from './routes/notes.js';

export default definePlugin({
	// demo_notes in Pouchbase: the plugin id as prefix.
	collections: { notes },
	routes: { '/notes': notesRoute }
});`
);

export const collectionPermissions = snippet(
	'json',
	`
{
	"id": "demo",
	"permissions": {
		"network": ["www.githubstatus.com"],
		"collections": {
			"read": ["users"],
			"write": ["posts"]
		}
	}
}`
);

export const testPouch = snippet(
	'typescript',
	`
import { fakeContext, fakePouch } from '@pouchbasejs/plugin-sdk/testing';
import { expect, it } from 'vitest';

import { GET } from '../routes/notes.js';

it('reads the notes through ctx.pouch', async () => {
	const pouch = fakePouch(({ method, path }) =>
		method === 'GET' && path === '/api/db/demo_notes'
			? { items: [], total: 0, limit: 20, offset: 0 }
			: new Response(null, { status: 404 })
	);
	const { ctx } = fakeContext({ pouch: pouch.client, user: { id: 'u1', /* … */ } as never });

	expect((await GET(new Request('https://pouchbase.test'), ctx)).status).toBe(200);
	expect(pouch.requests[0]?.query.get('where')).toBe('author == "u1"');
});`
);

export const packageDefaults = snippet(
	'json',
	`
{
	"name": "color-picker",
	"version": "1.2.0",
	"description": "Adds a color field type.",
	"license": "MIT",
	"author": "Jane Doe <jane@example.com> (https://example.com)"
}`
);

export const manifestCommand = snippet(
	'bash',
	`
npx pouchbase-plugin manifest > manifest.json   # the full manifest, with everything plugin.ts adds`
);

export const field = snippet(
	'typescript',
	`
import { defineField } from '@pouchbasejs/plugin-sdk/server';

import Input from './input.svelte';
import Preview from './preview.svelte';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export default defineField({
	label: 'Color',
	description: 'A color as a hex code, e.g. #ff6600.',
	column: 'TEXT', // TEXT, INTEGER, REAL or BLOB; fixed for the lifetime of each field
	input: Input, // edits the value in the record form
	preview: Preview, // shows it in the records grid (optional)
	icon: 'lucide:palette', // an Iconify name, or an imported .svg file (optional)
	validate(value) {
		return typeof value === 'string' && HEX_COLOR.test(value)
			? { valid: true }
			: { valid: false, message: 'Enter a color, e.g. #ff6600' };
	},
	serialize(value) {
		return String(value).toLowerCase(); // #FF6600 and #ff6600 are stored the same
	}
});`
);

export const fieldPlugin = snippet(
	'typescript',
	`
import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import color from './fields/color/field.js';

const plugin = definePlugin({
	fields: { color } // the key is the type: color-picker:color
});`
);

export const fieldInput = snippet(
	'svelte',
	`
<script lang="ts">
	import type { FieldInputProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Input from '@pouchbasejs/ui/inputs/input';

	let { name, value, required, disabled, id, errorId }: FieldInputProps<string> = $props();

	let current = $derived(value ?? '#000000');
</script>

<div class="flex items-center gap-2">
	<!-- Named name: this control submits the value with the record form. -->
	<input type="color" {id} {name} bind:value={current} {required} {disabled} aria-describedby={errorId} />
	<Input.Root value={current} readonly aria-label="Hex code" class="w-28 font-mono" />
</div>`
);

export const fieldPreview = snippet(
	'svelte',
	`
<script lang="ts">
	import type { FieldPreviewProps } from '@pouchbasejs/plugin-sdk/ui';

	let { value }: FieldPreviewProps<string> = $props();
</script>

{#if value !== null}
	<span class="inline-flex items-center gap-1.5 font-mono">
		<span class="size-3 rounded-sm border border-zinc-200" style:background-color={value}></span>
		{value}
	</span>
{/if}`
);

export const page = snippet(
	'svelte',
	`
<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	import * as Card from '@pouchbasejs/ui/card';

	let { params, api }: PageProps = $props();

	// GET /api/plugins/color-picker/stats, with the admin's session
	const stats = $derived(api.fetch('/stats').then((response) => response.json()));
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Palette</Card.Title>
	</Card.Header>
	<Card.Content>
		{#await stats then { colors }}
			<p>{colors} colors in use</p>
		{/await}
		<p>Path below the page: /{params.join('/')}</p>
	</Card.Content>
</Card.Root>`
);

export const pagePlugin = snippet(
	'typescript',
	`
import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import Palette from './pages/palette.svelte';
import Monthly from './pages/reports/monthly.svelte';
import settings from './pages/settings.js';

const plugin = definePlugin({
	pages: {
		// /plugins/color-picker/palette, first in the sidebar
		palette: { title: 'Palette', icon: 'lucide:swatch-book', component: Palette },
		// /plugins/color-picker/reports/monthly, titled "Monthly"
		'reports/monthly': { icon: 'lucide:calendar', component: Monthly },
		// a page defined in a file of its own
		settings
	}
});`
);

export const definePage = snippet(
	'typescript',
	`
import { definePage } from '@pouchbasejs/plugin-sdk/server';

import Settings from './settings.svelte';

export default definePage({
	component: Settings,
	title: 'Color settings',
	navigation: false // reached through a link on another page, not the sidebar
});`
);

export const icons = snippet(
	'typescript',
	`
import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import gradientIcon from './lib/gradient.svg';
import Gradients from './pages/gradients.svelte';
import Palette from './pages/palette.svelte';

export default definePlugin({
	pages: {
		// An icon of an Iconify set, turned into an SVG file of the bundle
		palette: { icon: 'lucide:swatch-book', component: Palette },
		// An .svg file of the plugin, imported like a module
		gradients: { icon: gradientIcon, component: Gradients }
	}
});`
);

export const iconSrc = snippet(
	'svelte',
	`
<script lang="ts">
	import * as Icon from '@pouchbasejs/ui/icon';

	import { DROPLET } from '../lib/icons.js'; // export const DROPLET = '<svg ...>...</svg>';

	const droplet = \`data:image/svg+xml,\${encodeURIComponent(DROPLET)}\`;
</script>

<!-- Drawn in the text color, at the size of the dashboard's icons -->
<Icon.Root src={droplet} />

<!-- An icon of a field type or page of this plugin, served by Pouchbase -->
<Icon.Root src="/api/plugins/color-picker/assets/ui/icons/lucide/palette.svg" />`
);

export const route = demo('typescript', demoInfo);

export const routeCurl = snippet(
	'bash',
	`
curl https://<your-pouchbase>/api/plugins/demo/info
# {"id":"demo","version":"…","greeting":"Hello","settings":{…},"admin":false}`
);

export const routeParams = demo('typescript', demoItem);

export const routesPlugin = snippet(
	'typescript',
	`
import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import * as info from './routes/info.js';
import * as item from './routes/item.js';

const plugin = definePlugin({
	routes: {
		'/info': info, // a module that exports GET, POST, ...
		'/items/:id': item, // :id is in ctx.params
		'/health': { GET: () => Response.json({ ok: true }) } // or the handlers themselves
	}
});`
);

export const routeUser = demo('typescript', demoMe);

export const authProvider = snippet(
	'typescript',
	`
import { createOidcProvider, defineAuthProvider } from '@pouchbasejs/plugin-sdk/server';

import logo from './icon.svg';

export default defineAuthProvider({
	...createOidcProvider({
		authorizeUrl: 'https://gitlab.com/oauth/authorize',
		tokenUrl: 'https://gitlab.com/oauth/token',
		userinfoUrl: 'https://gitlab.com/oauth/userinfo'
	}),
	label: 'GitLab', // on the sign-in button; defaults to the id, capitalized
	icon: logo, // the logo on the button, in its own colors; or an Iconify name
	consoleUrl: 'https://gitlab.com/-/user_settings/applications' // where an admin registers the app
});`
);

export const authProviderPlugin = snippet(
	'typescript',
	`
import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

import gitlab from './auth/gitlab/provider.js';

export default definePlugin({
	authProviders: { gitlab } // the key is the provider id
});`
);

export const authProviderProfile = demo('typescript', githubProvider);

export const setting = snippet(
	'typescript',
	`
import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

const plugin = definePlugin({
	settings: [
		{ key: 'api_key', label: 'API key', type: 'secret', required: true },
		{ key: 'region', label: 'Region', type: 'text', default: 'eu' },
		{ key: 'limit', label: 'Daily limit', type: 'number' },
		{ key: 'verbose', label: 'Verbose logging', type: 'boolean', default: false }
	]
});

export default plugin;

// Types ctx.settings.get(key) everywhere in the plugin.
declare module '@pouchbasejs/plugin-sdk/server' {
	interface Register {
		plugin: typeof plugin;
	}
}`
);

export const readSetting = snippet(
	'typescript',
	`
import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

export const GET: RouteHandler = async (_request, ctx) => {
	const apiKey = await ctx.settings.get('api_key'); // string | null: required, but no default
	const region = await ctx.settings.get('region'); // string: has a default
	const limit = await ctx.settings.get('limit'); // number | null
	const verbose = await ctx.settings.get('verbose'); // boolean: has a default
	const all = await ctx.settings.getAll(); // { api_key, region, limit, verbose }

	// await ctx.settings.get('regoin'); would be a type error: not a setting of plugin.ts

	if (apiKey === null) {
		// Until an admin saves it; the dashboard marks the plugin "Needs settings" meanwhile.
		return Response.json({ error: 'Fill in the API key on the Plugins page' }, { status: 503 });
	}

	return Response.json({ region, limit, verbose, keys: Object.keys(all) });
};`
);

export const addSetting = snippet(
	'bash',
	`
npx pouchbase-plugin add setting api_key --type secret   # creates plugin.ts with the Register block
npx pouchbase-plugin add setting limit --type number     # appends to its settings`
);

export const outsideApi = demo('typescript', demoGithubStatus);

export const testRoute = snippet(
	'typescript',
	`
// test/routes.test.ts
import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { describe, expect, it } from 'vitest';

import plugin from '../plugin.js';
import manifest from '../pouchbase-plugin.json' with { type: 'json' };

// The handler as plugin.ts registers it, typed
const { GET } = plugin.routes['/stats'];
const request = new Request('https://pouchbase.test/api/plugins/color-picker/stats');

describe('GET /stats', () => {
	it('calls the API with the saved key', async () => {
		const { ctx, requests } = fakeContext({
			manifest, // ctx.plugin, and the hosts ctx.fetch may reach
			plugin, // the settings of plugin.ts, with their defaults
			settings: { api_key: 'secret' }, // what an admin saved, as strings
			responses: { 'https://api.example.com/v1/colors': { count: 3 } }
		});

		const response = await GET(request, ctx);

		expect(await response.json()).toEqual({ colors: 3 });
		expect(requests[0]?.headers.get('authorization')).toBe('Bearer secret');
	});

	it('is for admins only', async () => {
		const { ctx } = fakeContext({ manifest, plugin, admin: false });

		expect((await GET(request, ctx)).status).toBe(403);
	});
});`
);

export const testField = snippet(
	'typescript',
	`
// test/color.test.ts
import type { FieldTypeHandler } from '@pouchbasejs/plugin-sdk/server';

import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { expect, it } from 'vitest';

import plugin from '../plugin.js';

// Called the way Pouchbase calls it: with the field's options and the plugin context.
const color: FieldTypeHandler = plugin.fields.color;
const { ctx } = fakeContext();

it('stores colors in lowercase', async () => {
	expect(await color.validate?.('#FF6600', {}, ctx)).toEqual({ valid: true });
	expect(await color.serialize?.('#FF6600', ctx)).toBe('#ff6600');
});

it('refuses what is not a color', async () => {
	expect(await color.validate?.('orange', {}, ctx)).toMatchObject({ valid: false });
});`
);

export const vitestConfig = snippet(
	'typescript',
	`
import { pouchbasePlugin } from '@pouchbasejs/plugin-sdk/vite';
import { defineConfig } from 'vitest/config';

// Imports of .svelte and .svg files are references to the files, as when the plugin is built.
export default defineConfig({ plugins: [pouchbasePlugin()] });`
);

export const testSettings = snippet(
	'typescript',
	`
// test/settings.test.ts
import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';
import { expect, it } from 'vitest';

import plugin from '../plugin.js';

it('parses saved values like Pouchbase', async () => {
	const { ctx } = fakeContext({ plugin, settings: { limit: '42', verbose: 'true' } });

	expect(await ctx.settings.get('limit')).toBe(42);
	expect(await ctx.settings.get('verbose')).toBe(true);
	expect(await ctx.settings.get('region')).toBe('eu'); // the default
	expect(await ctx.settings.get('api_key')).toBeNull(); // required, but not saved yet
});`
);

export const debugLogs = snippet(
	'bash',
	`
# The log of a plugin's Worker, live: <instance>-plugin-<id>, pouchbase-plugin-<id> by default
npx wrangler tail pouchbase-plugin-color-picker`
);

export const routeErrors = snippet(
	'bash',
	`
$ curl -i https://<your-pouchbase>/api/plugins/color-picker/stats
HTTP/2 502
{"message":"The plugin route failed"}

# The Pouchbase log has the reason:
[plugins] color-picker GET /stats: Cannot read properties of undefined (reading 'count')`
);

export const build = snippet(
	'bash',
	`
npx pouchbase-plugin validate
npx pouchbase-plugin build   # writes dist/color-picker-1.2.0.json`
);

export const publish = snippet(
	'bash',
	`
export POUCHBASE_REGISTRY_TOKEN=pbp_...   # a publish token from your pouchbase.io account
npx pouchbase-plugin publish             # builds, checks and uploads the bundle`
);

export const ci = snippet(
	'bash',
	`
# For example in a GitHub Actions step, with the token as a repository secret
POUCHBASE_REGISTRY_TOKEN=\${{ secrets.POUCHBASE_REGISTRY_TOKEN }} npx pouchbase-plugin publish --quiet`
);
