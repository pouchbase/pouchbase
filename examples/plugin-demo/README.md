# Demo plugin

A reference [Pouchbase](https://pouchbase.io) plugin that uses every part of [`@pouchbasejs/plugin-sdk`](../../packages/plugin-sdk) and its `pouchbase-plugin` CLI. Copy what you need; `npx @pouchbasejs/plugin-sdk init` starts a new plugin from a smaller template.

It contributes:

- a **field type**, `demo:rating`: 1 to 5 stars in an `INTEGER` column, with an input, a cell and validation on the server;
- a **dashboard page**, `/plugins/demo/overview`, built from `@pouchbasejs/ui` components, that calls the plugin's routes;
- three **routes** under `/api/plugins/demo/`: `GET /info` (reads a setting), `POST /echo` (reads a JSON body) and `GET /github-status` (calls an outside API, allowed by `permissions.network`).

For sign-in providers, see the first-party plugins in [`plugins/`](../../plugins), e.g. [`auth-github`](../../plugins/auth-github).

## Layout

```
plugin-demo/
├── pouchbase-plugin.json     # the manifest: id, permissions, server entry, contributions
├── package.json              # version, license, author, …: the CLI copies them into the manifest
├── server/
│   ├── index.ts              # definePlugin({ fields, routes }), the manifest's `server`
│   ├── rating.ts             # defineField: validate, serialize, deserialize
│   └── routes.ts             # the route handlers
├── ui/
│   ├── rating.ts             # a TypeScript module shared by the components and the server
│   ├── rating-input.svelte   # FieldInputProps: edits the value in the record form
│   ├── rating-cell.svelte    # FieldCellProps: shows the value in the records grid
│   └── overview-page.svelte  # PageProps: calls the routes with api.fetch
└── test/
    ├── context.ts            # a fake PluginContext with canned fetch responses
    ├── rating.test.ts
    └── routes.test.ts
```

## Things to notice

- The manifest has no `version`, `description` or `license`: `withPackageDefaults` takes them from `package.json`, so a release bumps one file.
- Server code runs sandboxed and may not import anything at runtime; `pouchbase-plugin build` bundles `server/` and the files it imports (here `ui/rating.ts`) into one `server.js`.
- UI files may only import `svelte`, `@pouchbasejs/plugin-sdk/ui`, `@pouchbasejs/ui/*` and other files in `ui/`. The host provides those modules, so they are devDependencies here, for type checking only.
- The input submits its value through a hidden `<input name={name}>`, because the visible control (a segmented control) isn't a form element.
- Plugin components are compiled by the host and don't get the dashboard's Tailwind classes; use `@pouchbasejs/ui` components and inline styles for layout.
- `ctx.fetch` only reaches the hosts in `permissions.network`; `test/context.ts` does the same, so a test fails when the code calls a host the manifest doesn't list.

## Scripts

Inside this repository, from the root (the SDK's CLI runs from its `dist/`, so build it first with `pnpm --filter @pouchbasejs/plugin-sdk build`):

```sh
pnpm --filter pouchbase-plugin-demo dev        # rebuild on every change, serve on http://localhost:4510
pnpm --filter pouchbase-plugin-demo validate   # check the manifest, the files and the server code
pnpm --filter pouchbase-plugin-demo build      # write dist/demo-<version>.json
pnpm --filter pouchbase-plugin-demo test
pnpm --filter pouchbase-plugin-demo check
```

To try it in the dashboard, start Pouchbase with `POUCHBASE_REGISTRY_URL=http://localhost:4510` while `dev` runs, and install **Demo** from the Plugins page.

Outside this repository, replace the `workspace:*` versions in `package.json` with the published ones (e.g. `"@pouchbasejs/plugin-sdk": "^0.2.0"`, `"@pouchbasejs/ui": "^0.1.0"`) and add a `"release": "pouchbase-plugin publish"` script. This demo has none on purpose: it is never published.
