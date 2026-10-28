# @pouchbasejs/plugin-sdk

## 0.4.0

### Minor Changes

- [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Rename a field type's cell to its preview: `preview` in `defineField` and in the manifest, and `FieldPreviewProps`; the manifest key `cell` and `FieldCellProps` are gone.

- [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Order a plugin's pages and their sidebar links by the order of `pages` in `definePlugin`.

- [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add `ctx.pouch`, a client of `@pouchbasejs/js-sdk` for the records API, collections of a plugin's own with `collections` in `definePlugin` (and `defineCollection()`), `permissions.collections` to read or write the app's collections, and `fakePouch()` in `@pouchbasejs/plugin-sdk/testing`.

- [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Build a plugin from one `definePlugin({ ... })` in `plugin.ts` that declares its settings, field types, pages (with their title, sidebar link, icon and `layout`: the reading width, the full width, or all of the space), sign-in providers and routes by id, importing their code, components and `.svg` icons from any folder; the CLI writes the manifest itself (`pouchbase-plugin manifest` prints it). `add` creates the files of a contribution and adds it to `plugin.ts`, `validate` checks imports and compiles components exactly as Pouchbase does, components and icons are typed (`@pouchbasejs/plugin-sdk/env`), field types, pages and sign-in providers can have icons, `@pouchbasejs/plugin-sdk/vite` lets tests import `plugin.ts`, and `@pouchbasejs/plugin-sdk/testing` provides `fakeContext()`. The former layout, with `contributes` and `server` in `pouchbase-plugin.json` and components in `ui/`, is gone: the CLI refuses those keys. `HOST_MODULES` and `isHostModule` are removed in favor of `HOST_MODULE_IDS` and `isHostModuleId`.

- [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Raise the bundle limit (`MAX_BUNDLE_SIZE`) from 1 MiB to 25 MiB, and add `splitBundle` to cut a bundle's text into parts that fit in a database row.

- [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Compile the Tailwind classes of a plugin's components into the bundle, with the dashboard's design tokens, so plugins can be styled like the dashboard.

### Patch Changes

- Updated dependencies [[`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176), [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0), [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176), [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6), [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176), [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6), [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140), [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38), [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0), [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6), [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176), [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140)]:
  - @pouchbasejs/js-sdk@0.8.0

## 0.3.0

### Minor Changes

- [`c350354`](https://github.com/pouchbase/pouchbase/commit/c3503548ee4006a208c3d609966bda31dce6efb3) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Give clear feedback in every `pouchbase-plugin` command: each step of a build, where the registry and token come from, an early check for a missing token or an already published version, what changed and what Pouchbase downloaded in `dev`, hints on how to fix errors, and `--quiet` and `--verbose` options.

- [`6758ac4`](https://github.com/pouchbase/pouchbase/commit/6758ac4612d3891cd27b6b9f80a088786a1c7106) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Plugins can have their own icon: `icon` in the manifest points to an SVG in `ui/`, shown in the marketplace, on pouchbase.io and in the list of installed plugins.

### Patch Changes

- [`d15310b`](https://github.com/pouchbase/pouchbase/commit/d15310b5950064879e920d510bde2eb9f727aa3f) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - The plugin registry of an instance is set with `POUCHBASE_REGISTRY_URL`, the same variable `pouchbase-plugin publish` reads; `PLUGIN_REGISTRY_URL` still works when it isn't set.

## 0.2.0

### Minor Changes

- [`3096c45`](https://github.com/pouchbase/pouchbase/commit/3096c457493558e9cd2df9fdad8f4d92b4e1e35e) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Plugins can declare `categories`, and the registry API filters by category. The manifest can leave out `name`, `version`, `license` and other fields that `package.json` has, takes a `$schema` for editor completion (`pouchbase-plugin schema` prints it), and the server module adds `createOidcProvider`, `fetchJson`, `defineField` and `defineAuthProvider`. `pouchbase-plugin init` offers `field`, `page`, `auth-provider` and `empty` templates, `pouchbase-plugin add` adds a field, page or auth provider with its files, `dev` serves every build as `<version>-dev.<n>` (unless `--exact-version`), and `validate` checks the server code's handlers against the manifest. UI files may import the dashboard's components from `@pouchbasejs/ui` (`HOST_MODULES`), auth providers can have an SVG `icon` from `ui/` (provider ids follow the exported `PROVIDER_ID_PATTERN`), and bundles may hold `.svg` files. The docs describe how hosts run server code (in its own Worker on your Cloudflare account) and that `*.example.com` in `permissions.network` matches subdomains, not `example.com` itself. Provider ids `password`, `email` and `otp` are reserved (`RESERVED_PROVIDER_IDS`), and bundles whose server code still imports other modules are refused (`serverCodeIssues`).

## 0.1.1

### Patch Changes

- [`346ed1a`](https://github.com/pouchbase/pouchbase/commit/346ed1afcc5171bfa03b2f31e5b025244bd347e5) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - The public plugin registry is now at `https://api.pouchbase.io`: the Plugins page and `pouchbase-plugin publish` use it unless `PLUGIN_REGISTRY_URL` or `--registry` says otherwise.

## 0.1.0

### Minor Changes

- [`ee260bf`](https://github.com/pouchbase/pouchbase/commit/ee260bf2e3772369d13e3a3badd0d6f59e6073ad) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add **Plugins** under System: search the plugin marketplace and install, update or remove plugins. Installs are checked against the plugin's integrity hash, its manifest and the plugin API version. Plugins are built with the new `@pouchbasejs/plugin-sdk` package (manifest schema, types and the `pouchbase-plugin` CLI with `init`, `dev`, `build` and `publish`), and may use any license under the new Pouchbase Plugin Exception. Running what plugins add (field types, pages and sign-in providers) follows in a later release.
