# @pouchbasejs/plugin-sdk

Types, the manifest schema and the `pouchbase-plugin` CLI for building [Pouchbase](https://pouchbase.io) plugins. Plugins add field types, dashboard pages, API routes and sign-in providers to a Pouchbase instance, and are installed from the plugin registry on the Plugins page of the dashboard, without rebuilding Pouchbase.

> [!NOTE]
> This is plugin API version 1. Pouchbase installs plugins from the registry and runs what they contribute: field types in the collections and the record form, pages in the dashboard, routes under `/api/plugins/<id>/` and sign-in providers.

## Quick start

```bash
npx @pouchbasejs/plugin-sdk init color-picker
cd color-picker
pnpm install
pnpm dev
```

`init` asks for a template (in a terminal; otherwise, or with `--template`, it uses the one given or `field`):

| Template        |                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field`         | A color field type with an input, a preview and validation on the server (`fields/color/`).                                                          |
| `page`          | A dashboard page (`pages/hello.svelte`) that calls the plugin's `GET /hello` (`routes/hello.ts`), which reads a `greeting` setting from `plugin.ts`. |
| `auth-provider` | A sign-in provider with `createOidcProvider`; `init auth-acme` creates `auth/acme/`.                                                                 |
| `empty`         | Only the manifest and an icon; add contributions with `pouchbase-plugin add`.                                                                        |

Every template writes a small `pouchbase-plugin.json` with `$schema`, `id` and `name` (and `categories`, except `empty`; `auth-provider` also writes an example host in `permissions.network`), sets `engines.pouchbase` to `>=0.10.0`, keeps `version`, `description` and `license` in `package.json`, type-checks the plugin's folders and `test/` in `tsconfig.json`, and comes with a test in `test/` and the scripts `dev`, `check` (`svelte-check`), `test` (`vitest run`), `validate`, `build` and `release`.

For a complete example with field types, pages, routes, settings, tests and every CLI command, see [`examples/plugin-demo`](https://github.com/pouchbase/pouchbase/tree/main/examples/plugin-demo). The guide, with testing, debugging, limits and the security model, is on [pouchbase.io/docs/plugins](https://pouchbase.io/docs/plugins); this README is the reference.

`pnpm dev` rebuilds the plugin on every change and serves it from a local registry on `http://localhost:4510`. Start a Pouchbase on the same machine with `POUCHBASE_REGISTRY_URL=http://localhost:4510` (any installation, such as the Docker image, or `pnpm dev` in the Pouchbase repository) and install the plugin from the Plugins page. Every build is served as a new prerelease, `<version>-dev.<n>`, so Pouchbase sees it as an update; `--exact-version` serves the version from `package.json` instead.

- Installing a plugin with server code (field types, auth providers or routes) deploys a real Worker to the Cloudflare account Pouchbase uses, even from a Pouchbase on your machine: it needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, and the account a `workers.dev` subdomain (else error 19011).
- A Pouchbase deployed elsewhere can't reach `localhost:4510`; publish to a registry it can reach instead.

Add more to a plugin with `add`, which creates the files of a contribution (it never overwrites one):

```bash
npx pouchbase-plugin add field rating            # fields/rating/field.ts, input.svelte, preview.svelte
npx pouchbase-plugin add page reports/monthly    # pages/reports/monthly.svelte
npx pouchbase-plugin add route items/:id         # routes/items/[id].ts
npx pouchbase-plugin add auth-provider gitlab    # auth/gitlab/provider.ts, auth/gitlab/icon.svg
npx pouchbase-plugin add setting api_key --type secret   # a setting in plugin.ts
```

The files are the contribution, so `add` only touches `pouchbase-plugin.json` to add the category of the new contribution to an explicit `categories` list, or the example host of a new auth provider to `permissions.network`. `add setting <key> [--type text|secret|number|boolean|url]` appends a setting to `plugin.ts`, and creates that file, with the `Register` block, when the plugin has none (see [Settings](#settings)).

## A plugin

The folders of a plugin say what it contributes:

```
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
└── lib/                         # code shared by the rest
```

| File                               | Contributes                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `fields/<type>/field.ts`           | The field type `<type>` (stored as `<plugin>:<type>`): default-exports `defineField(...)`. Needs `input.svelte`. |
| `fields/<type>/icon.svg`           | The field type's icon, when `defineField` names none. See [Icons](#icons).                                       |
| `pages/<path>.svelte`              | A page at `/plugins/<plugin>/<path>`; `pages/<path>/index.svelte` is the same page.                              |
| `pages/<path>.svg`                 | The page's icon in the sidebar (`stats.svg` for `stats.svelte`), when its meta names none.                       |
| `auth/<id>/provider.ts`            | The sign-in provider `<id>`: default-exports `defineAuthProvider(...)`; `icon.svg` next to it is its logo.       |
| `routes/<path>.ts`                 | Routes at `/api/plugins/<plugin>/<path>`: one export per method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).       |
| `plugin.ts`                        | The plugin's settings: default-exports `definePlugin({ settings })`. See [Settings](#settings).                  |
| `icon.svg`                         | The plugin's icon in the marketplace and the dashboard; square, shown at 40 pixels and smaller.                  |
| Anything else, e.g. `lib/stars.ts` | Shared code: imported by the files above, never a contribution itself.                                           |

- Names are lowercase: field types use letters, numbers and underscores (`rich_color`), pages and providers lowercase words separated by dashes (`monthly-report`). A route segment is `[a-z0-9]` with single `-`, `_` or `.` between them, so `routes/status.json.ts` answers `/status.json`.
- Files and folders whose name starts with `_` (`pages/_parts/header.svelte`, `routes/_auth.ts`) are never pages or routes, so they can hold components and helpers next to the files that use them.
- `pages/index.svelte` is refused, because a page needs a path below `/plugins/<plugin>/`; route paths below `/assets` and `/modules` belong to Pouchbase.
- Tests (`*.test.ts`, `*.spec.ts`) and declarations (`*.d.ts`) in `routes/` are ignored.

`pouchbase-plugin validate` reports every problem with the file it concerns and how to fix it, e.g. `fields/rating: has no input.svelte: every field type needs an input component`.

### Manifest

`pouchbase-plugin.json` holds what isn't code:

```json
{
	"$schema": "https://pouchbase.io/schemas/plugin-manifest.json",
	"id": "color-picker",
	"name": "Color picker",
	"categories": ["fields", "pages"],
	"engines": { "pouchbase": ">=0.10.0" },
	"permissions": { "network": ["api.example.com"] }
}
```

| Field                 |                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | Unique in the registry: lowercase words separated by dashes. Everything the plugin adds is namespaced by it (`color-picker:color`, `/plugins/color-picker/palette`). |
| `name`                | The plugin's name in the marketplace and the dashboard.                                                                                                              |
| `apiVersion`          | The plugin API version the plugin is written against; defaults to the SDK's `API_VERSION`.                                                                           |
| `icon`                | Path of the plugin's icon (an SVG) in the project; defaults to `icon.svg` when there is one. Without one, Pouchbase shows a puzzle piece.                            |
| `categories`          | Up to three of `PLUGIN_CATEGORIES`, where the registry lists the plugin. See [Categories](#categories).                                                              |
| `engines.pouchbase`   | Semver range of the Pouchbase versions the plugin works with; `>=0.10.0` for a plugin in the convention layout. See [Versioning](#versioning).                       |
| `permissions.network` | Hosts the server code may reach over HTTPS; `*.example.com` matches its subdomains, not `example.com` itself. Shown to the admin before installing.                  |

`name`, `version`, `description`, `license`, `author`, `homepage`, `repository` and `keywords` may be left out when the plugin's `package.json` has them; the CLI fills them in (`withPackageDefaults`), and a value in the manifest wins. So `version` can live in `package.json` alone. `author` may use npm's `Name <email> (url)` form, and `repository` is turned into a browsable URL (`git+https://github.com/me/plugin.git` → `https://github.com/me/plugin`).

The CLI turns the folders into the full manifest that hosts and the registry see, with a `contributes` list and every path a bundle path. `pouchbase-plugin manifest` prints it:

```bash
npx pouchbase-plugin manifest > manifest.json   # the JSON on stdout, the steps on stderr
```

`"$schema": "https://pouchbase.io/schemas/plugin-manifest.json"` (`MANIFEST_SCHEMA_URL`) gives editors completion and checks. `pouchbase-plugin schema` prints the same JSON Schema (`manifestJsonSchema()`), which describes the full manifest: `apiVersion` is optional there (it defaults to `API_VERSION`), and `contributes`, `server` and `settings` are marked deprecated, because the CLI fills them in from the folders and `plugin.ts`. `parseManifest(json)` validates a full manifest the same way Pouchbase does on install.

### Settings

Settings are values an admin enters on the Plugins page (an API key, a region, a greeting). They are code, so they are typed: `plugin.ts` at the root of the plugin default-exports `definePlugin({ settings })` with up to 30 of them, and the CLI puts them into the manifest, from which Pouchbase builds the settings form:

```ts
import { definePlugin } from '@pouchbasejs/plugin-sdk/server';

const plugin = definePlugin({
	settings: [
		{ key: 'api_key', label: 'API key', type: 'secret', required: true },
		{ key: 'region', label: 'Region', description: 'Where the API runs.', default: 'eu' },
		{ key: 'limit', label: 'Limit', type: 'number' }
	]
});

export default plugin;

// Types ctx.settings.get(key) everywhere in the plugin.
declare module '@pouchbasejs/plugin-sdk/server' {
	interface Register {
		plugin: typeof plugin;
	}
}
```

| Key           |                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `key`         | How the code reads it: `ctx.settings.get('api_key')`. Lowercase letters, numbers and underscores; unique.  |
| `label`       | Its name in the settings form.                                                                             |
| `description` | One sentence under the field (optional).                                                                   |
| `type`        | `text` (default), `secret` (never shown again once saved), `number`, `boolean` or `url` (an absolute URL). |
| `required`    | The plugin can't work without it; the dashboard marks the plugin "Needs settings" until it is saved.       |
| `default`     | Used while nothing is saved; of the setting's type. A `secret` has no default.                             |

`await ctx.settings.get(key)` returns the saved value, else the `default`, else `null`, parsed by `type`: a `number` setting gives a number, a `boolean` setting a boolean, the others a string. `ctx.settings.getAll()` gives every setting by key. With the `Register` block:

- `key` is one of the keys of `plugin.ts`; a typo is a type error.
- A setting with a `default` is never `null`: `region` above is a `string`.
- Every other setting is `| null`, `required` ones too: `api_key` is `string | null` until an admin saves it (meanwhile the dashboard marks the plugin "Needs settings"), and `limit` is `number | null`.

Without the block, `get` takes any key and returns `string | number | boolean | null`. Keep `plugin.ts` in the `include` of `tsconfig.json` (the templates do), or the block doesn't apply.

`pouchbase-plugin add setting <key> --type <type>` appends a setting to `plugin.ts`, and creates the file with the `Register` block when the plugin has none. `pouchbase-plugin validate` checks the settings like the manifest (`settings.0.default: Must be a number`), and refuses a `settings` key in `pouchbase-plugin.json`: in the convention layout settings live in `plugin.ts` only. Like `field.ts`, the CLI runs `plugin.ts` in Node.js to read it, and it may only hold `settings`.

Pouchbase stores the values as strings (`'42'`, `'true'`) and sends them, secrets included, to the plugin's Worker with every call. In tests, `fakeContext({ plugin, settings: { limit: '42' } })` from [`@pouchbasejs/plugin-sdk/testing`](#testing) builds the same `ctx.settings` as Pouchbase (`createPluginSettings(definitions, values)` and `parseSettingValue(setting, raw)` are the parts it uses). Settings are not copied between Pouchbase instances, since they may hold secrets. Renaming or removing a setting loses its saved value on update.

### Field types

`fields/<type>/field.ts` default-exports `defineField(...)`. The CLI reads `label`, `description`, `column` and `icon` into the manifest by running the file in Node.js when it builds, so keep its top level free of APIs only the sandbox has:

```ts
import { defineField } from '@pouchbasejs/plugin-sdk/server';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export default defineField({
	label: 'Color', // defaults to the folder name, `Color`
	description: 'A color as a hex code, e.g. #ff6600.',
	column: 'TEXT', // TEXT, INTEGER, REAL or BLOB; fixed for the lifetime of each field
	icon: 'lucide:palette', // an Iconify name or an .svg file; see Icons
	validate: (value) =>
		typeof value === 'string' && HEX_COLOR.test(value)
			? { valid: true }
			: { valid: false, message: 'Enter a color, e.g. #ff6600' },
	serialize: (value) => String(value).toLowerCase()
});
```

- `validate(value, options, ctx)` checks a value from the record form (a string) or the API before it is saved, `serialize(value, ctx)` turns it into the stored column value and `deserialize(value, ctx)` turns the stored value into what the API returns; each one is optional.
- `input.svelte` receives `FieldInputProps` and must submit the value with a form control named `name` (a hidden `<input>` when something else edits it).
- `preview.svelte` is the type's **preview**: it shows the value, read-only, in the records grid, and receives `FieldPreviewProps`; without one the grid shows the value as text.
- Previews used to be called cells: `cell.svelte`, the manifest key `cell` and `FieldCellProps` still work in plugin API version 1, and the CLI warns to rename them.

### Pages

A page is a Svelte component in `pages/` that receives `PageProps`: `params`, the path below the page (`['2026', '10']` for `/plugins/<plugin>/reports/2026/10`), and `api.fetch(path, init)`, which calls the plugin's own routes with the admin's session. Its title, whether it gets a link in the sidebar and the icon of that link come from its `<script module>`:

```svelte
<script module lang="ts">
	import type { PageMeta } from '@pouchbasejs/plugin-sdk/ui';

	export const page = {
		title: 'Monthly report',
		navigation: true,
		icon: 'lucide:calendar' // an Iconify name or an .svg file; see Icons
	} satisfies PageMeta;
</script>

<script lang="ts">
	import type { PageProps } from '@pouchbasejs/plugin-sdk/ui';

	let { params, api }: PageProps = $props();
</script>
```

The CLI reads `page` without running the component, so it must be a literal: no variables or function calls, apart from `definePage({ ... })` from `@pouchbasejs/plugin-sdk/ui`, which types it like `satisfies PageMeta`. Without it, the title is the file name (`monthly-report.svelte` → `Monthly report`) and the page is in the sidebar. Pages come in the order of their `order` (lower first), then by path; the sidebar lists them in that order.

### Icons

Field types and pages have an icon in the dashboard, drawn like its own icons: in one color (the text color, light or dark), at 16 pixels, next to the built-in field types in the add-field dialog, in the field list and the grid headers, and in the sidebar. Only the shape of the icon counts, so a monochrome icon works best; without one, a field type shows a puzzle piece, and so does a page. The plugin's own `icon.svg` is its logo in the marketplace, never the icon of a field type or page.

`icon` in `defineField` or in a page's `page` meta is either:

- an [Iconify](https://icon-sets.iconify.design) name, e.g. `lucide:palette` (the set of the dashboard's own icons). The CLI turns it into an SVG file of the bundle (`ui/icons/lucide/palette.svg`), so Pouchbase never fetches an icon. It looks the name up in the icon set `@iconify-json/<prefix>` installed in the plugin, then in the SDK, which comes with `@iconify-json/lucide`; for other sets it fetches the icon from `https://api.iconify.design` once and keeps it in `node_modules/.cache/pouchbase-plugin/icons`. Install the set (`pnpm add -D @iconify-json/mdi`) to build offline. The log says where each icon comes from: `Resolved icon lucide:palette for field color (@iconify-json/lucide of @pouchbasejs/plugin-sdk)`.
- the path of an `.svg` file of the plugin, relative to the file that names it (`'./palette.svg'`, `'../../lib/icons/palette.svg'`).

Without `icon`, the CLI uses `fields/<type>/icon.svg` for a field type and the `.svg` file with the page's name for a page (`pages/stats.svg` for `pages/stats.svelte`, `pages/reports/index.svg` for `pages/reports/index.svelte`), when there is one.

An icon is a plain SVG image of at most 32 KiB (`MAX_ICON_SIZE`): it starts with `<svg` (after an optional `<?xml ?>` prolog and comments), has no `<script>`, `<foreignObject>`, `<!DOCTYPE>`, event handler attributes (`onload="…"`) or `javascript:` URLs, and refers to nothing outside itself (`href` and `url()` only point to `#id`s). `svgIconIssues(svg)` checks one; `validate`, `build` and Pouchbase (`parseBundle`) refuse icons that break these rules. In the manifest, `icon` of a field or page contribution is the bundle path of the file (`ui/icons/lucide/palette.svg`); a plugin in the [legacy layout](#legacy-layout) sets that path itself.

### Routes

A file in `routes/` exports a `RouteHandler` per HTTP method it answers. `[name]` in a file or folder name is a param, in `ctx.params`; `index.ts` answers the folder's path:

```ts
// routes/items/[id].ts: GET and DELETE /api/plugins/<plugin>/items/:id
import type { RouteHandler } from '@pouchbasejs/plugin-sdk/server';

export const GET: RouteHandler = async (request, ctx) => Response.json({ id: ctx.params.id });

export const DELETE: RouteHandler = async (request, ctx) => {
	if (!ctx.admin) {
		return Response.json({ error: 'Admins only' }, { status: 403 });
	}

	return Response.json({ deleted: ctx.params.id });
};
```

Routes are public: anyone can call them. `ctx.admin` is `true` only for a request from an admin signed in to the dashboard (a valid admin session on a same-origin request, as `api.fetch` from a page makes); `ctx.user` is the app user of the request's `Authorization: Bearer <token>`, or `null` without one (an invalid or expired token is answered with 401 before the route runs; API keys are not users). A static segment wins over a param (`/items/new` over `/items/:id`), a path that exists with another method answers 405 (`HEAD` included) and an unknown path 404. A handler that throws, doesn't return a `Response` or doesn't start answering within 10 seconds gives the caller 502 `{"message":"The plugin route failed"}`; the reason is only in the Pouchbase log. See [Security](#security) for the headers Pouchbase adds and removes.

### Auth providers

`auth/<id>/provider.ts` default-exports `defineAuthProvider(...)`. The `id` is the provider's public id (`gitlab`), used as is in the sign-in URLs and the API rather than namespaced by the plugin: Pouchbase refuses to install a plugin whose provider id another installed plugin already contributes, and `password`, `email` and `otp` are reserved (`RESERVED_PROVIDER_IDS`).

```ts
import { createOidcProvider, defineAuthProvider } from '@pouchbasejs/plugin-sdk/server';

export default defineAuthProvider({
	...createOidcProvider({
		authorizeUrl: 'https://gitlab.com/oauth/authorize',
		tokenUrl: 'https://gitlab.com/oauth/token',
		userinfoUrl: 'https://gitlab.com/oauth/userinfo'
	}),
	label: 'GitLab', // on the sign-in button; defaults to the folder name
	consoleUrl: 'https://gitlab.com/-/user_settings/applications' // where an admin registers the app
});
```

The host reads `authorizeUrl`, `tokenUrl`, `scopes` and `pkce` when the plugin is installed and does the OAuth redirect and the token exchange itself; only `profile(accessToken, credentials, ctx)` runs during a sign-in, and returns the provider's user (`OAuthProfile`). Only set `emailVerified` when the provider guarantees the email belongs to the user: it links a sign-in to an existing user with that email.

### Server code

The field types, auth providers and routes are bundled into one module that runs in its own Worker on your Cloudflare account (built-in plugins, which ship with Pouchbase, run inside Pouchbase). It can't import Node.js modules or reach the network, except through `ctx.fetch` to the HTTPS hosts in `permissions.network`; the Worker has no bindings, and the global `fetch` is limited to the same hosts. Redirects are not followed: `ctx.fetch` returns the redirect response, and fetching its `Location` is checked again. Packages a server file imports are bundled into it, so they must be installed.

What the handlers get:

| Member                               |                                                                                                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.plugin`, `ctx.fetch`, `ctx.log` | The plugin's id and version, the allowlisted `fetch`, and `info`/`warn`/`error`, written to the console of the plugin's Worker (`<instance>-plugin-<id>`; for built-in plugins, the Pouchbase log).              |
| `ctx.settings.get(key)`              | A promise of a setting from `plugin.ts`, parsed by its type: the value an admin saved, else its `default`, else `null`. `ctx.settings.getAll()` gives them all. See [Settings](#settings).                       |
| `ctx.user`                           | In a route: the app user of the request's bearer token (`id`, `email`, `name`, `verified`, `avatar` and the other `fields` of the `users` collection; never passwords or tokens), or `null`. Else always `null`. |
| `ctx.admin`                          | `true` only for a request from an admin signed in to the dashboard; `false` for every other request to a route and outside routes.                                                                               |
| `ctx.params`                         | In a route: the `[name]` segments of its file, e.g. `{ id: '42' }` for `routes/items/[id].ts`.                                                                                                                   |

`@pouchbasejs/plugin-sdk/server` has a few helpers; like the rest of the module, they only use `ctx.fetch`:

| Helper                                                                                     |                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineField(handler)`, `defineAuthProvider(handler)`                                      | Type a field type or an auth provider.                                                                                                                                                                                                                            |
| `definePlugin({ settings })`                                                               | Types `plugin.ts`, with literal keys and types for `Register`.                                                                                                                                                                                                    |
| `createPluginSettings(settings, values)`, `parseSettingValue(setting, raw)`                | `ctx.settings` for setting definitions and saved string values, as Pouchbase builds it; for tests.                                                                                                                                                                |
| `fetchJson<T>(ctx, url, accessToken, headers?)`                                            | GET JSON with `Authorization: Bearer <token>`, `Accept: application/json` and a `User-Agent`; `headers` adds to them (e.g. `Client-Id`). Throws on a non-2xx response.                                                                                            |
| `createOidcProvider({ authorizeUrl, tokenUrl, userinfoUrl, scopes?, pkce?, mapProfile? })` | An auth provider for an OpenID Connect provider: the profile comes from the userinfo endpoint (`sub`, `email`, `email_verified`, `name`, `picture`). Scopes default to `openid email profile`, PKCE to on; `mapProfile(claims, profile, ctx)` adjusts the result. |

A provider with its own profile API writes `profile` itself:

```ts
import { defineAuthProvider, fetchJson } from '@pouchbasejs/plugin-sdk/server';

export default defineAuthProvider({
	label: 'Codeberg',
	authorizeUrl: 'https://codeberg.org/login/oauth/authorize',
	tokenUrl: 'https://codeberg.org/login/oauth/access_token',
	scopes: ['read:user'],
	pkce: true,
	async profile(accessToken, credentials, ctx) {
		const user = await fetchJson<{ id: number; login: string; email: string; avatar_url: string }>(
			ctx,
			'https://codeberg.org/api/v1/user',
			accessToken
		);

		return {
			id: String(user.id),
			email: user.email || null,
			emailVerified: false,
			name: user.login,
			avatarUrl: user.avatar_url
		};
	}
});
```

### UI components

Pouchbase compiles the plugin's `.svelte` files with its own Svelte compiler on install and renders them in the dashboard (client-side only). A component that doesn't compile stops the install; one that throws while rendering shows `<plugin> failed: <message>` in its place. They receive the props from `@pouchbasejs/plugin-sdk/ui` (`FieldInputProps`, `FieldPreviewProps`, `PageProps`).

**Imports.** A UI file may import, with static `import` statements only (no dynamic `import()`):

- other `.svelte`, `.ts` and `.js` files of the plugin, by relative path;
- exactly the modules in `HOST_MODULE_IDS`, which Pouchbase provides at runtime in the versions the dashboard uses:

  - Svelte: `svelte`, `svelte/store`, `svelte/transition`, `svelte/animate`, `svelte/easing`, `svelte/motion`, `svelte/reactivity`, `svelte/events` and `svelte/attachments` (the compiled code also imports `svelte/internal/*`, which Pouchbase provides too);
  - the prop types and `PageMeta`: `@pouchbasejs/plugin-sdk/ui`;
  - the dashboard's components: `@pouchbasejs/ui` and one entry per component, `@pouchbasejs/ui/badge`, `/button`, `/callout`, `/card`, `/empty`, `/icon`, `/link`, `/meter`, `/progress`, `/scroll-area`, `/segmented`, `/skeleton`, `/spinner`, `/swatch`, `/table`, `/thumbnail`, `/tile`, `/tooltip`, `/inputs/checkbox`, `/inputs/input`, `/inputs/select`, `/inputs/slider` and `/inputs/textarea` (`import * as Button from '@pouchbasejs/ui/button'`).

Nothing else: no other packages, which aren't in the browser, and no files outside the plugin.

- `validate`, `build` and `dev` apply exactly these rules, the same code Pouchbase runs on install (`compileUi`), and compile every component with Svelte, so they report what would stop the install as `file:line:column: message`.
- A plugin never ships its own copy of these modules; install `svelte` and `@pouchbasejs/ui` as devDependencies for type checking (the templates do).
- Import shared modules such as `lib/stars.ts` by their `.js` name (`../../lib/stars.js`), as they are in the bundle. The CLI compiles TypeScript modules to JavaScript and only bundles the files the components actually import.
- Server files (`field.ts`, `provider.ts`, `routes/`, `plugin.ts`) can't be imported: move what both need into `lib/`.
- Only JavaScript is linked: put styles in a `<style>` block of the component (scoped to it), inline JSON data in a `.ts` module and SVG markup in a component or a string.

**Styling.** Components from [`@pouchbasejs/ui`](https://www.npmjs.com/package/@pouchbasejs/ui) look and behave like the rest of the dashboard. For everything else, use [Tailwind](https://tailwindcss.com) classes, as the dashboard does:

- `build`, `dev` and `validate` compile the classes the components use into `ui/tailwind.css` of the bundle (a name the CLI reserves).
- The theme is Tailwind's default with the dashboard's design tokens from `@pouchbasejs/ui/tokens.css` (`h-control` for controls, `h-row` for rows, the chart colours, ...). Without `@pouchbasejs/ui` 0.2 or later in the project, the classes use the default theme only and the CLI warns.
- Only the utilities are compiled, in the dashboard's `theme` and `utilities` layers, because the dashboard already has Tailwind's base styles; a class means the same in a plugin as in the dashboard.

**Icons.** `Icon.Root` from `@pouchbasejs/ui/icon`:

- with `src`, draws an SVG image from a URL in the text color: a `data:image/svg+xml,...` URL of markup in a `.ts` module, or an icon in the bundle, which Pouchbase serves at `/api/plugins/<id>/assets/<bundle path>` (`ui/icons/lucide/palette.svg` for a field type's `lucide:palette`). This always works.
- with `icon="lucide:…"`, renders at once only the icons the dashboard bundles for its own use; for any other name, `@iconify/svelte` fetches the icon from the Iconify API in the admin's browser, so it appears late or not at all offline, and the bundled set can change between Pouchbase versions. Prefer `src`.

### Legacy layout

Plugins written before the convention list their contributions in `contributes` and point `server` to an entry that default-exports `definePlugin({ fields, authProviders, routes })`, with every component and image in `ui/`:

```json
{
	"apiVersion": 1,
	"id": "color-picker",
	"name": "Color picker",
	"server": "server/index.ts",
	"contributes": {
		"fields": [
			{
				"type": "color",
				"label": "Color",
				"description": "A hex color.",
				"column": "TEXT",
				"input": "ui/color-input.svelte"
			}
		]
	}
}
```

A manifest with `contributes` or `server` still builds, with a deprecation warning; the layout stops working in plugin API version 2. It can't be mixed with the convention folders: a plugin with `contributes` and a `fields/` folder is refused. To move a plugin, put each contribution in its folder (`ui/color-input.svelte` → `fields/color/input.svelte`, its handler → `fields/color/field.ts` with `label`, `description` and `column`, `routes['GET /stats']` → `export const GET` in `routes/stats.ts`), remove `contributes` and `server`, and compare the result with `pouchbase-plugin manifest`. `add field|page|auth-provider` keeps writing the legacy layout in a legacy plugin; `add route` needs the convention. A legacy plugin keeps its `settings` in the manifest (`add setting` appends them there), and its `plugin.ts`, if any, is not read for settings; move them into `plugin.ts` together with the contributions. Its `ui/` files may import `.svelte` and `.js` files; every `.css` file in `ui/` is loaded with the plugin without an import.

### Categories

The registry and the Plugins page group plugins by category. The list is fixed (`PLUGIN_CATEGORIES`, with names in `PLUGIN_CATEGORY_LABELS`):

| Category          | Name              |
| ----------------- | ----------------- |
| `auth`            | Sign-in providers |
| `fields`          | Field types       |
| `pages`           | Pages             |
| `integrations`    | Integrations      |
| `developer-tools` | Developer tools   |

`pouchbase-plugin validate`, `build` and the registry reject other categories; Pouchbase itself only checks the format, so a plugin with a category added in a later SDK still installs. Without `categories`, a plugin is listed under the ones its contributions imply (`effectiveCategories`): `auth` for auth providers, `fields` for fields and `pages` for pages.

### Versioning

- `API_VERSION` is the version of everything in this package: the manifest, the project layout, the bundle format, the server API and the component props, and of the modules the host provides to UI files (`HOST_MODULES`), including the component names and props of `@pouchbasejs/ui`.
- Within an API version, changes are only additive (new optional manifest fields, new contribution kinds, new context members). Pouchbase ignores what it doesn't know. A plugin that needs something added later sets `engines.pouchbase`.
- A change that would break existing plugins bumps the API version. Pouchbase supports the current API version and the one before it (`SUPPORTED_API_VERSIONS`), and refuses plugins it can't run (`checkCompatibility`).
- The convention layout, previews and Tailwind classes ship with Pouchbase 0.10.0, so `engines.pouchbase` starts at `>=0.10.0`; raise it when a plugin uses something newer. Pouchbase only installs a version whose range it satisfies.

An update replaces the plugin's code and keeps its data and saved settings, but some changes break existing installations:

- A field keeps the `column` type it was created with; a new `column` only applies to new fields.
- Renaming or removing a setting loses the value saved under the old key.
- Renaming or removing a field type orphans the fields of the old type: they keep their data but are read-only, as when the plugin is removed. Provider ids are just as permanent.
- Changing `serialize` doesn't rewrite stored values, so `deserialize` and the preview must keep reading the old form.

## Testing

`@pouchbasejs/plugin-sdk/testing` (Node.js) has `fakeContext(options)`, the `ctx` Pouchbase would pass to field hooks, auth providers and routes, for vitest or any test runner:

```ts
import { fakeContext } from '@pouchbasejs/plugin-sdk/testing';

import plugin from '../plugin.js';
import manifest from '../pouchbase-plugin.json' with { type: 'json' };
import { GET } from '../routes/stats.js';

const { ctx, requests, logs } = fakeContext({
	manifest, // ctx.plugin, and permissions.network for ctx.fetch
	plugin, // the setting definitions of plugin.ts
	settings: { api_key: 'secret' }, // saved values, as the strings Pouchbase stores
	responses: { 'https://api.example.com/v1/colors': { count: 3 } },
	admin: true
});
const response = await GET(
	new Request('https://pouchbase.test/api/plugins/color-picker/stats'),
	ctx
);
```

| Option                    |                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest`                | `id` and `version` become `ctx.plugin`; `ctx.fetch` reaches only HTTPS hosts in `permissions.network`, `*.example.com` wildcards included, and throws like Pouchbase for others. |
| `plugin`                  | The default export of `plugin.ts`, for the settings and their defaults.                                                                                                          |
| `settings`                | What an admin saved, as strings; `ctx.settings.get` parses them by type, like Pouchbase.                                                                                         |
| `responses`               | Answers of `ctx.fetch` by URL, or by `METHOD URL` (which comes first): a `Response`, a function of the request, or a JSON body. Other URLs answer 404.                           |
| `user`, `admin`, `params` | `ctx.user` (default `null`), `ctx.admin` (default `false`) and `ctx.params` (default `{}`).                                                                                      |

It returns `ctx`, the `requests` that reached `ctx.fetch` and the `logs` of `ctx.log`. The templates run the tests with `pnpm test` and type-check the TypeScript and `.svelte` files with `pnpm check` (`svelte-check`; plain `tsc` skips components); `validate` compiles the components as Pouchbase does.

## Limits

| What                  | Limit                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Bundle                | 1 MiB (`MAX_BUNDLE_SIZE`)                                                                                                   |
| Call                  | 10 seconds for a field hook or `profile`, and until a route's response starts                                               |
| Contributions         | 20 field types, 20 pages, 10 auth providers, 30 settings (`MAX_PLUGIN_SETTINGS`)                                            |
| Names                 | Plugin id up to 64 characters, field type up to 32, setting key up to 63                                                    |
| Icons                 | 32 KiB each (`MAX_ICON_SIZE`)                                                                                               |
| `permissions.network` | Up to 20 host names (`api.example.com`, `*.example.com`): no schemes, ports, paths, IP addresses or `localhost`; HTTPS only |
| Categories            | 3 (`MAX_CATEGORIES`)                                                                                                        |

Plugin Workers also follow the limits of the Cloudflare Workers plan. On Pouchbase hosted on Workers, installing a plugin compiles its components inside Pouchbase's request, which may need more CPU time than the Workers Free plan allows for a plugin with many or large components.

## Security

- Routes are public and answer any origin (`Access-Control-Allow-Origin: *` unless the plugin sets its own CORS headers).
- `ctx.admin` needs an admin session and a same-origin request (`Sec-Fetch-Site: same-origin` or `none`); the `Cookie` header is never forwarded to the plugin.
- `ctx.user` comes from `Authorization: Bearer <token>`; an invalid or expired token gets 401 before the plugin runs, and API keys are not users.
- Pouchbase adds `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff` to every route response.
- Only `GET`, `POST`, `PUT`, `PATCH` and `DELETE` are routable.
- The Worker replaces `fetch` and `WebSocket` before the plugin's code runs, so both only reach the hosts in `permissions.network`, over HTTPS (WSS); redirects aren't followed. The bundle can't import anything, so other Workers APIs are out of reach too.
- The Worker has no bindings. Pouchbase sends it only each call's data, including the settings in plain text, secrets too.
- Components run in the dashboard with the admin's privileges; only install plugins you trust.

## Bundle

`pouchbase-plugin build` writes one JSON file, `dist/<id>-<version>.json`: the full manifest, the server code bundled into `server.js`, and the UI files under `ui/` at their path in the project (`fields/rating/input.svelte` → `ui/fields/rating/input.svelte`, `lib/stars.ts` → `ui/lib/stars.js`, `icon.svg` → `ui/icon.svg`, an icon by Iconify name → `ui/icons/<prefix>/<name>.svg`; `.svelte`, `.js`, `.css`, `.json` and `.svg` files, though in the convention layout only components, modules and images end up there). `server.js` may not import anything, `cloudflare:*` and `node:*` modules included: `parseBundle` (used by the CLI, the registry and Pouchbase) refuses server code with static or dynamic imports (`serverCodeIssues`). Bundles are at most 1 MiB (`MAX_BUNDLE_SIZE`). The registry lists a Subresource Integrity hash (`sha256-…`) with every version, and Pouchbase refuses a download that doesn't match.

## Registry API

The dashboard and the CLI talk to a plugin registry (`https://api.pouchbase.io` by default) through `createRegistryClient`. Any server that implements these endpoints can be a registry:

| Method | Path                                                  | Response                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/plugins?q=&category=&page=&perPage=&apiVersion=` | `PluginList`; `category` only lists plugins in that category                                                                                                                                                   |
| GET    | `/v1/plugins/:id`                                     | `PluginDetails`, 404                                                                                                                                                                                           |
| GET    | `/v1/plugins/:id/versions/:version`                   | `PluginVersion`, 404; `:version` may be `latest`                                                                                                                                                               |
| GET    | `PluginVersion.bundleUrl`                             | the bundle                                                                                                                                                                                                     |
| POST   | `/v1/plugins/:id/versions`                            | 201 `PluginVersion`; 401 without a valid token, 403 for another account's plugin, 409 for a published version, 413 above 1 MiB, 422 for an invalid bundle. The bundle as body, `Authorization: Bearer <token>` |

Errors have the body `{ "error": { "code": "...", "message": "...", "issues": [...] } }`.

A `PluginVersion` may have `contributes`, a summary of what the version adds for the install dialog: `{ fields: [{ type, label }], pages: [{ path, title }], authProviders: [{ id, label }], routes: ['GET /stats'], settings: [{ key, label }] }`. `contributionSummary(manifest, routes)` builds it; registries that leave it out still parse. The pouchbase.io registry fills it for a version and for the newest version in `PluginDetails`, with the route keys it finds in `server.js`.

## CLI

| Command                                                         |                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pouchbase-plugin init <dir> [--template <name>]`               | Create a plugin from `field`, `page`, `auth-provider` or `empty`; the directory name becomes its id. Asks for the template in a terminal.                                                                                                                                                                 |
| `pouchbase-plugin add <field\|page\|auth-provider\|route> <id>` | Create the files of a contribution, e.g. `add route items/:id`.                                                                                                                                                                                                                                           |
| `pouchbase-plugin add setting <key> [--type <type>]`            | Append a setting to `plugin.ts` (created with the `Register` block when missing); `--type` is `text` (default), `secret`, `number`, `boolean` or `url`.                                                                                                                                                   |
| `pouchbase-plugin validate`                                     | Check the folders, the manifest, the settings and the server code, and compile the UI files with Pouchbase's import rules; reports what it found, e.g. `Found 3 field types (color, phone, rating), 3 pages (overview, fields, api), 5 routes (POST /echo, …), 3 settings (greeting, max_length, shout)`. |
| `pouchbase-plugin manifest`                                     | Print the full manifest the plugin builds into, as JSON on stdout (the steps go to stderr).                                                                                                                                                                                                               |
| `pouchbase-plugin build`                                        | Write the bundle to `dist/`.                                                                                                                                                                                                                                                                              |
| `pouchbase-plugin dev [--port 4510] [--exact-version]`          | Rebuild on every change and serve the plugin from a local registry, as `<version>-dev.<n>` unless `--exact-version`.                                                                                                                                                                                      |
| `pouchbase-plugin schema`                                       | Print the JSON Schema of the manifest.                                                                                                                                                                                                                                                                    |
| `pouchbase-plugin publish [--registry <url>] [--token <token>]` | Build and publish; defaults to `$POUCHBASE_REGISTRY_URL` and `$POUCHBASE_REGISTRY_TOKEN`. Create a publish token under **Account** on [pouchbase.io](https://pouchbase.io/account), or upload the bundle there.                                                                                           |

Every command reports what it does (`›`), what it found, how it ended (`✓` or `✗`, with a hint on how to fix an error) and what to do next. Results go to stdout, warnings (`!`) and errors to stderr, with colors only in a terminal (`NO_COLOR` turns them off). Two options apply to every command:

| Option          | Effect                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| `-q, --quiet`   | Only results, warnings and errors, e.g. in CI.                               |
| `-v, --verbose` | Also stack traces and every request to the dev registry, to debug a problem. |

`publish` checks the token before building, shows the registry it uses and where that comes from, and looks the plugin up first, so a version that is already published fails before the upload.

## Tools

`@pouchbasejs/plugin-sdk/project` (Node.js only) reads a plugin project the way the CLI does, for tools that build plugins themselves:

| Export                                  |                                                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `discoverProject(root, { log? })`       | `{ mode, manifest, uiFiles, uiSources, serverEntry, serverCode, routes, found, warnings }`: the full manifest, the UI files by bundle path (and the project file each comes from), the server entry's source and its bundle, and the route keys. |
| `generateServerEntry(input, { root? })` | The source of the server entry for `{ fields, authProviders, routes, plugin? }` files (`plugin` is `plugin.ts`, whose settings join the entry), importing them by absolute path.                                                                 |
| `buildBundle(root, { log? })`           | `{ bundle, bytes, warnings, routes, project }`: the bundle and its serialized bytes, as `pouchbase-plugin build` writes them, the warnings, the route keys and the `discoverProject` result.                                                     |
| `ProjectError`                          | What they throw: a message, the `issues` with the files they concern, and a `hint`.                                                                                                                                                              |

## License

MIT. Plugins may use any license: see the [Pouchbase Plugin Exception](https://github.com/pouchbase/pouchbase/blob/main/PLUGIN-EXCEPTION.md).
