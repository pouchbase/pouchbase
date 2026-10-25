import { snippet, type Language } from '#lib/highlight.js';

// Files of the demo plugin (`examples/plugin-demo`), inlined at build time, so the samples that
// say they come from the demo are always the demo's current code.
import demoGithubStatus from '../../../../../examples/plugin-demo/routes/github-status.ts?raw';
import demoInfo from '../../../../../examples/plugin-demo/routes/info.ts?raw';
import demoItem from '../../../../../examples/plugin-demo/routes/items/[id].ts?raw';
import demoMe from '../../../../../examples/plugin-demo/routes/me.ts?raw';

/** A file of the demo plugin as a snippet, with Unix line endings whatever the checkout has. */
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
npx pouchbase-plugin add field rating            # fields/rating/field.ts, input.svelte, preview.svelte
npx pouchbase-plugin add page reports/monthly    # pages/reports/monthly.svelte
npx pouchbase-plugin add route items/:id         # routes/items/[id].ts
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
├── plugin.ts                    # definePlugin({ settings }): what an admin fills in (optional)
├── icon.svg                     # the plugin's icon (optional)
├── fields/
│   └── color/
│       ├── field.ts             # defineField({ label, description, column, validate, ... })
│       ├── input.svelte         # edits the value in the record form (required)
│       ├── preview.svelte       # shows the value, read-only, in the records grid (optional)
│       └── icon.svg             # the type's icon, unless defineField names one (optional)
├── pages/
│   ├── palette.svelte           # /plugins/color-picker/palette
│   ├── palette.svg              # its icon in the sidebar, unless its meta names one (optional)
│   └── reports/
│       └── index.svelte         # /plugins/color-picker/reports
├── auth/
│   └── gitlab/
│       ├── provider.ts          # defineAuthProvider({ ... })
│       └── icon.svg             # the provider's logo (optional)
├── routes/
│   ├── index.ts                 # /api/plugins/color-picker
│   ├── stats.ts                 # /api/plugins/color-picker/stats
│   └── items/
│       └── [id].ts              # /api/plugins/color-picker/items/:id
└── lib/                         # code shared by the rest`
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
npx pouchbase-plugin manifest > manifest.json   # the full manifest, with every contribution`
);

export const field = snippet(
	'typescript',
	`
// fields/color/field.ts: the field type color-picker:color
import { defineField } from '@pouchbasejs/plugin-sdk/server';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export default defineField({
	label: 'Color', // defaults to the folder name
	description: 'A color as a hex code, e.g. #ff6600.',
	column: 'TEXT', // TEXT, INTEGER, REAL or BLOB; fixed for the lifetime of each field
	icon: 'lucide:palette', // an Iconify name, or the path of an .svg file
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

export const fieldInput = snippet(
	'html',
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
	'html',
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
	'html',
	`
<script module lang="ts">
	import type { PageMeta } from '@pouchbasejs/plugin-sdk/ui';

	// A literal: the CLI reads it without running the page.
	export const page = {
		title: 'Palette',
		navigation: true,
		order: 1,
		icon: 'lucide:swatch-book'
	} satisfies PageMeta;
</script>

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

export const icons = snippet(
	'typescript',
	`
// fields/color/field.ts: an icon of an Iconify set, turned into an SVG file of the bundle
export default defineField({ label: 'Color', icon: 'lucide:palette' /* , ... */ });

// fields/gradient/field.ts: an .svg file of the plugin, relative to field.ts
export default defineField({ label: 'Gradient', icon: '../../lib/gradient.svg' /* , ... */ });

// fields/swatch/field.ts without icon: fields/swatch/icon.svg, when there is one`
);

export const iconSrc = snippet(
	'html',
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

export const routeUser = demo('typescript', demoMe);

export const authProvider = snippet(
	'typescript',
	`
// auth/gitlab/provider.ts: the sign-in provider gitlab
import { createOidcProvider, defineAuthProvider } from '@pouchbasejs/plugin-sdk/server';

export default defineAuthProvider({
	...createOidcProvider({
		authorizeUrl: 'https://gitlab.com/oauth/authorize',
		tokenUrl: 'https://gitlab.com/oauth/token',
		userinfoUrl: 'https://gitlab.com/oauth/userinfo'
	}),
	label: 'GitLab', // on the sign-in button; defaults to the folder name
	consoleUrl: 'https://gitlab.com/-/user_settings/applications' // where an admin registers the app
});`
);

export const authProviderProfile = snippet(
	'typescript',
	`
// auth/github/provider.ts: a provider with its own profile API
import { defineAuthProvider, fetchJson } from '@pouchbasejs/plugin-sdk/server';

type GitHubUser = { id: number; login: string; name: string | null; avatar_url: string | null };
type GitHubEmail = { email: string; primary: boolean; verified: boolean };

export default defineAuthProvider({
	label: 'GitHub',
	consoleUrl: 'https://github.com/settings/developers',
	authorizeUrl: 'https://github.com/login/oauth/authorize',
	tokenUrl: 'https://github.com/login/oauth/access_token',
	scopes: ['read:user', 'user:email'],
	pkce: false,
	async profile(accessToken, _credentials, ctx) {
		const [user, emails] = await Promise.all([
			fetchJson<GitHubUser>(ctx, 'https://api.github.com/user', accessToken),
			fetchJson<GitHubEmail[]>(ctx, 'https://api.github.com/user/emails', accessToken)
		]);
		const primary = emails.find((email) => email.primary) ?? emails[0];

		return {
			id: String(user.id),
			email: primary?.email ?? null,
			emailVerified: primary?.verified === true,
			name: user.name ?? user.login,
			avatarUrl: user.avatar_url
		};
	}
});`
);

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
import { GET } from '../routes/stats.js';

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

import field from '../fields/color/field.js';

// Called the way Pouchbase calls it: with the field's options and the plugin context.
const color: FieldTypeHandler = field;
const { ctx } = fakeContext();

it('stores colors in lowercase', async () => {
	expect(await color.validate?.('#FF6600', {}, ctx)).toEqual({ valid: true });
	expect(await color.serialize?.('#FF6600', ctx)).toBe('#ff6600');
});

it('refuses what is not a color', async () => {
	expect(await color.validate?.('orange', {}, ctx)).toMatchObject({ valid: false });
});`
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
