# Demo plugin

A reference [Pouchbase](https://pouchbase.io) plugin that uses every part of [`@pouchbasejs/plugin-sdk`](../../packages/plugin-sdk) and its `pouchbase-plugin` CLI except sign-in providers. Copy what you need; `npx @pouchbasejs/plugin-sdk init` starts a new plugin from a smaller template. The guide is on [pouchbase.io/docs/plugins](https://pouchbase.io/docs/plugins), and some of its samples are files of this plugin.

`plugin.ts` says what it contributes, in one `definePlugin({ ... })`, and Pouchbase runs all of it once the plugin is installed:

- three **field types** (`fields`, each a `defineField` in `fields/<type>/field.ts`), each with an input in the record form, a preview in the records grid and validation on the server:
  - `demo:rating`: 1 to 5 stars in an `INTEGER` column;
  - `demo:color`: a hex color in a `TEXT` column, picked with the browser's color picker or typed, stored as `#rrggbb`;
  - `demo:phone`: an international phone number in a `TEXT` column, typed with any spaces, dashes or parentheses and stored without them (`+31612345678`), shown as a `tel:` link;
- three **dashboard pages** (`pages`, components in `pages/`), built from `@pouchbasejs/ui` components and linked in the sidebar under **Plugins**, in the order of `plugin.ts`:
  - **Demo** (`/plugins/demo/overview`): what the plugin adds, its settings and an outside API's status, from the routes;
  - **Field playground** (`/plugins/demo/fields`): the field types' inputs and previews, checked with the same rules as on the server;
  - **API explorer** (`/plugins/demo/api`): calls every route and shows the answer;
- five **routes** under `/api/plugins/demo/` (`routes`, modules in `routes/`): `GET /info` (reads the settings and `ctx.admin`), `POST /echo` (reads a JSON body and a number and a boolean setting), `GET /github-status` (calls an outside API, allowed by `permissions.network`), `GET /me` (the signed-in app user, `ctx.user`) and `GET /items/:id` (`routes/item.ts`, a parameter in `ctx.params`);
- three **settings** (`settings`) that an admin can change on the Plugins page: `greeting` (text, default `Hello`), `max_length` (number, default `280`) and `shout` (boolean, default `false`); `ctx.settings.get` returns them as a string, a number and a boolean.

For sign-in providers, see the first-party plugins in [`plugins/`](../../plugins), e.g. [`auth-github`](../../plugins/auth-github).

## Layout

`plugin.ts` imports everything it names, so the folders are only this plugin's choice:

```
plugin-demo/
├── pouchbase-plugin.json     # id, name, categories, engines, permissions
├── plugin.ts                 # definePlugin({ settings, fields, pages, routes }) and the Register block that types ctx.settings
├── package.json              # version, description, license, author, …: the CLI copies them into the manifest
├── icon.svg                  # the plugin's icon (its logo in the marketplace)
├── vitest.config.ts          # pouchbasePlugin(): tests can import plugin.ts and its .svelte imports
├── fields/
│   ├── rating/
│   │   ├── field.ts          # defineField: label, description, column, input, preview, icon, validate, serialize, deserialize
│   │   ├── input.svelte      # FieldInputProps: edits the value in the record form
│   │   └── preview.svelte    # FieldPreviewProps: shows the value, read-only, in the records grid
│   ├── color/                # field.ts, input.svelte, preview.svelte
│   └── phone/                # field.ts, input.svelte, preview.svelte
├── pages/
│   ├── overview.svelte       # PageProps: calls the routes with api.fetch
│   ├── fields.svelte         # the field playground
│   └── api.svelte            # the API explorer
├── components/               # components the pages and fields share
├── routes/
│   ├── info.ts               # export const GET
│   ├── echo.ts               # export const POST
│   ├── github-status.ts      # export const GET, with ctx.fetch
│   ├── me.ts                 # export const GET, with ctx.user
│   └── item.ts               # export const GET for /items/:id, with ctx.params.id
├── lib/
│   ├── catalog.ts            # what the plugin contributes, for field.ts and the pages
│   ├── check.ts              # the result of a field type's check
│   ├── rating.ts, color.ts, phone.ts   # the checks, shared by each field type and its components
│   └── api.ts                # getJson: api.fetch with JSON and errors
└── test/
    ├── context.ts            # a fake PluginContext with canned fetch responses and the settings of plugin.ts
    ├── rating.test.ts, color.test.ts, phone.test.ts, catalog.test.ts
    ├── routes.test.ts
    └── settings.test.ts      # ctx.settings is typed: a key plugin.ts doesn't declare is a type error
```

`npx pouchbase-plugin manifest` prints the full manifest the CLI builds from `plugin.ts`: the `contributes` list (`ui/fields/rating/input.svelte`, `ui/pages/overview.svelte`, …) and the `settings`, with `version`, `description` and `license` from `package.json`.

## Things to notice

- The manifest only holds what isn't code. Everything else comes from `plugin.ts`: a field type's label, description, column, components and icon from its `defineField`, a page's path, title and icon from its entry in `pages`, and the route keys from the methods each route module exports.
- `plugin.ts` imports the components (`import Overview from './pages/overview.svelte'`), and each `field.ts` its input and preview. The CLI runs `plugin.ts` in Node.js, where those imports are only references to the files; it compiles the components for the dashboard, and the server code keeps the handlers.
- Each field type and page has its own icon, an Iconify name from `lucide`: `lucide:star-half` (rating), `lucide:pipette` (color), `lucide:phone-call` (phone number), `lucide:layout-dashboard`, `lucide:shapes` and `lucide:terminal` (the pages). The CLI turns them into SVG files of the bundle (`ui/icons/lucide/star-half.svg`, …), and the dashboard draws them like its own icons in the add-field dialog, the field list, the grid headers and the sidebar. An imported `.svg` file (`import icon from './icon.svg'`) would work too.
- Inside the components, `Icon.Root icon="lucide:…"` only renders at once the icons the dashboard bundles itself; others are fetched from the Iconify API in the browser. `src` with an SVG URL always works (see the guide).
- The settings are code: the `declare module '@pouchbasejs/plugin-sdk/server' { interface Register { plugin: typeof plugin } }` block in `plugin.ts` types `ctx.settings.get` in every route and field type. `await ctx.settings.get('greeting')` is a `string` (the setting has a default); a number or boolean setting comes back as a number or a boolean, and a typo in the key fails `pnpm check`. `npx pouchbase-plugin add setting <key>` adds one.
- Server code runs in its own Worker and may not import anything at runtime; `pouchbase-plugin build` bundles `plugin.ts`, the handlers and what they import (here `lib/`) into one `server.js`.
- UI files may only import `svelte`, `@pouchbasejs/plugin-sdk/ui`, the `@pouchbasejs/ui` components and other files of the plugin, such as `lib/rating.ts`, which they import as `../../lib/rating.js` (its name in the bundle); not `plugin.ts` or a `field.ts`, which are server code. Pouchbase provides those modules, so they are devDependencies here, for type checking only.
- The rating input submits its value through a hidden `<input name={name}>`, because the visible control (a row of star buttons) isn't a form element. The color and phone inputs give `name` to a real `<input>` instead.
- `serialize` can normalize what is stored: the color field stores `#F80` as `#ff8800`, the phone field strips the separators, so the same color or number is always the same value.
- The components are styled with Tailwind classes, like the dashboard: the CLI compiles the classes they use into `ui/tailwind.css` of the bundle, with the dashboard's design tokens (`h-control`, …) from `@pouchbasejs/ui`. `npx pouchbase-plugin validate` reports how many classes that is.
- Routes are public: `GET /info` reports `ctx.admin`, which is only `true` when an admin calls it from the dashboard (the pages do, `curl` doesn't).
- `ctx.fetch` only reaches the hosts in `permissions.network`; `test/context.ts` does the same, so a test fails when the code calls a host the manifest doesn't list. A new plugin can use `fakeContext` from `@pouchbasejs/plugin-sdk/testing`, which does this too.

## Scripts

Inside this repository, from the root (the SDK's CLI runs from its `dist/`, so build it first with `pnpm --filter @pouchbasejs/plugin-sdk build`):

```sh
pnpm --filter pouchbase-plugin-demo dev        # rebuild on every change, serve on http://localhost:4510
pnpm --filter pouchbase-plugin-demo validate   # check plugin.ts, the manifest, the server code and the components
pnpm --filter pouchbase-plugin-demo build      # write dist/demo-<version>.json
pnpm --filter pouchbase-plugin-demo test
pnpm --filter pouchbase-plugin-demo check
```

To try it in the dashboard, start Pouchbase with `POUCHBASE_REGISTRY_URL=http://localhost:4510` while `dev` runs (`POUCHBASE_REGISTRY_URL=http://localhost:4510 pnpm dev` at the root), and install **Demo** from the Plugins page. The plugin has server code, so this deploys its Worker to the Cloudflare account in your `.env`. Then open **Plugins › Demo** in the sidebar, add a **Rating**, **Color** or **Phone number** field to a collection, or call a route:

```sh
curl http://localhost:5173/api/plugins/demo/info
```

Outside this repository, replace the `workspace:*` versions in `package.json` with the published ones (e.g. `"@pouchbasejs/plugin-sdk": "^0.4.0"`, `"@pouchbasejs/ui": "^0.2.0"`) and add a `"release": "pouchbase-plugin publish"` script. This demo has none on purpose: it is never published.
