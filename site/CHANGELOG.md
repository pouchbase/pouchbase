# pouchbase-site

## 0.7.0

### Minor Changes

- [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Split the docs into tabs for the platform, the JS SDK, the REST API and plugins, each with a sidebar of its own, under `/docs/platform`, `/docs/sdk`, `/docs/api` and `/docs/plugins`; the platform pages describe the dashboard and concepts, the SDK pages the TypeScript calls and the REST API pages every endpoint with cURL examples, responses and status codes, and a new API keys page explains the scopes

- [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Accept plugin bundles of up to 25 MiB in the registry instead of 1 MiB.

- [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Serve the docs for AI assistants: `/llms.txt`, `/llms-full.txt` and every docs page as Markdown at its URL plus `.md`.

- [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document every component of `@pouchbasejs/ui` in the docs, with a live preview, its source and its props, and link to them from the plugin docs and from code samples that import them.

### Patch Changes

- [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Move the account pages to `/account/login` and `/account/register`, and document the renamed auth methods and endpoints.

- [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document that every API key acts as an admin and that a client with an `apiKey` uses it on every call, without scopes or `pouch.asService()`; the site reads its key from `POUCHBASE_API_KEY` instead of `POUCHBASE_SERVICE_KEY`

- [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Split the collections docs into pages for records, filters, access rules, files, managing collections and the REST API, with example responses, a field type reference, the `where` forms and the conditions they become, rules for common cases, and the functions of conditions, including the date functions

- [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document sending emails of your own HTML with `pouch.mail.send()` and `POST /api/mail/send`, and the generated `MailTemplates` types.

- [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Group the docs sidebar into collapsible sections (installation, realtime, plugin topics and UI component categories) that open for the current page, scroll it on its own, open it from a menu button on small screens, and group the UI components overview by category.

- [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Tighten the docs and bring them in line with the current app, SDK and plugin SDK.

- [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - The filter and access rule docs use `&&`/`AND`, `||`/`OR` and `!`/`NOT`

- [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document hidden fields: who sees them, how they work in access rules, filters and `/api/auth/me`, and their place in the schema API and the generated types

- [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document `ctx.pouch`, a plugin's own collections and `permissions.collections` on a new Collections page of the plugin docs, and serve `permissions.collections` from the plugin registry.

- [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Explain in the plugin docs that components can use Tailwind classes with the dashboard's design tokens, call a field type's read-only component its preview, and document a page's `order`.

- [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Rewrite the plugin docs for building plugins with one `definePlugin({ ... })` in `plugin.ts` instead of by convention, split into an overview and focused pages (project structure, field types, pages, components and icons, routes, sign-in providers, settings, testing and debugging, publishing, security and limits, the CLI) with previous and next links, and list what a plugin adds in the registry; the pages docs cover a page's `layout`.

- [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document realtime with an API key: a client with an `apiKey` connects as an admin, and the protocol docs cover the key as the `auth` token and the `4401` close code

- [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Move the live updates docs to their own Realtime section, with an overview, subscriptions and the protocol, and document `subscribe()` and `unsubscribe()`

- [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document downloading the TypeScript types with an API key.
- Updated dependencies [[`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38), [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176), [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0), [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176), [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6), [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176), [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6), [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140), [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38), [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0), [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6), [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176), [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140), [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38), [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0), [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0), [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140), [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38), [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6), [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38), [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38)]:
  - @pouchbasejs/plugin-sdk@0.4.0
  - @pouchbasejs/js-sdk@0.8.0
  - @pouchbasejs/ui@0.2.0

## 0.6.0

### Minor Changes

- [`6758ac4`](https://github.com/pouchbase/pouchbase/commit/6758ac4612d3891cd27b6b9f80a088786a1c7106) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Plugins can have their own icon: `icon` in the manifest points to an SVG in `ui/`, shown in the marketplace, on pouchbase.io and in the list of installed plugins.

### Patch Changes

- [`2578b98`](https://github.com/pouchbase/pouchbase/commit/2578b98fa707dc84bc321901e8960960c50ecb9b) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document the redesigned API and SDK: sessions, conditions, live updates, the database and schema routes, and the new thumbnail sizes.

- [`d15310b`](https://github.com/pouchbase/pouchbase/commit/d15310b5950064879e920d510bde2eb9f727aa3f) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - The plugin registry of an instance is set with `POUCHBASE_REGISTRY_URL`, the same variable `pouchbase-plugin publish` reads; `PLUGIN_REGISTRY_URL` still works when it isn't set.

- [`8d541f5`](https://github.com/pouchbase/pouchbase/commit/8d541f5bfad78721de811ef89207af74c2c30c40) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Show a styled error page instead of SvelteKit's default one, and keep the account page usable when your plugins or publish tokens can't be loaded, with the reason
- Updated dependencies [[`c350354`](https://github.com/pouchbase/pouchbase/commit/c3503548ee4006a208c3d609966bda31dce6efb3), [`6758ac4`](https://github.com/pouchbase/pouchbase/commit/6758ac4612d3891cd27b6b9f80a088786a1c7106), [`d15310b`](https://github.com/pouchbase/pouchbase/commit/d15310b5950064879e920d510bde2eb9f727aa3f), [`2578b98`](https://github.com/pouchbase/pouchbase/commit/2578b98fa707dc84bc321901e8960960c50ecb9b)]:
  - @pouchbasejs/plugin-sdk@0.3.0
  - @pouchbasejs/js-sdk@0.7.0

## 0.5.0

### Minor Changes

- [`3096c45`](https://github.com/pouchbase/pouchbase/commit/3096c457493558e9cd2df9fdad8f4d92b4e1e35e) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Browse plugins on pouchbase.io and filter them by category. The plugin manifest's JSON Schema is served at `/schemas/plugin-manifest.json`, and the plugin docs cover the server helpers for sign-in providers, the `init` templates, `add`, dev versions, provider icons and the `@pouchbasejs/ui` components plugins can use. They also explain where plugin server code runs and how `permissions.network` wildcards match, and the authentication docs cover sign-in providers from plugins and their logos.

### Patch Changes

- [`beca993`](https://github.com/pouchbase/pouchbase/commit/beca9932da720984cd97cbe52ade9b0ee323c65c) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document what deleting a linked record does to relation fields

- [`5ec4111`](https://github.com/pouchbase/pouchbase/commit/5ec411154866d1b0fdf5dbef6d7a89b30f284d49) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Only let accounts in once their email address is verified, and say after sign-up that the verification email was sent
- Updated dependencies [[`3096c45`](https://github.com/pouchbase/pouchbase/commit/3096c457493558e9cd2df9fdad8f4d92b4e1e35e), [`beca993`](https://github.com/pouchbase/pouchbase/commit/beca9932da720984cd97cbe52ade9b0ee323c65c), [`3096c45`](https://github.com/pouchbase/pouchbase/commit/3096c457493558e9cd2df9fdad8f4d92b4e1e35e)]:
  - @pouchbasejs/plugin-sdk@0.2.0
  - @pouchbasejs/js-sdk@0.6.0

## 0.4.0

### Minor Changes

- [`346ed1a`](https://github.com/pouchbase/pouchbase/commit/346ed1afcc5171bfa03b2f31e5b025244bd347e5) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - The docs have a Plugins page on building plugins and publishing them to the registry.

### Patch Changes

- [`346ed1a`](https://github.com/pouchbase/pouchbase/commit/346ed1afcc5171bfa03b2f31e5b025244bd347e5) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - The docs point to the mail settings on the Mail page.

- [`346ed1a`](https://github.com/pouchbase/pouchbase/commit/346ed1afcc5171bfa03b2f31e5b025244bd347e5) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Accounts on pouchbase.io are created with a name and email instead of a username, and are only active once the email address is verified.
- Updated dependencies [[`346ed1a`](https://github.com/pouchbase/pouchbase/commit/346ed1afcc5171bfa03b2f31e5b025244bd347e5), [`346ed1a`](https://github.com/pouchbase/pouchbase/commit/346ed1afcc5171bfa03b2f31e5b025244bd347e5)]:
  - @pouchbasejs/plugin-sdk@0.1.1
  - @pouchbasejs/js-sdk@0.5.0

## 0.3.0

### Minor Changes

- [`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add accounts and the public plugin registry: sign up with a password or GitHub, publish plugins by uploading a bundle or with `pouchbase-plugin publish` and a publish token, and serve them to every Pouchbase through the registry API under `/v1`.

- [`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add a documentation section at `/docs`: a getting started guide that lets you choose how to self-host and then walks through Cloudflare Workers, Docker (including the VPS install script) or the single binary, and guides for authentication, collections and records, realtime, functions and email templates.

### Patch Changes

- Updated dependencies [[`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d), [`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d), [`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d), [`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d)]:
  - @pouchbasejs/js-sdk@0.4.0

## 0.2.2

### Patch Changes

- [`d4992e4`](https://github.com/pouchbase/pouchbase/commit/d4992e49d2a4f5789c07ceceda6cde7413fd9f5d) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document `pouchbase update` for the single binary.

## 0.2.1

### Patch Changes

- [`58029b0`](https://github.com/pouchbase/pouchbase/commit/58029b007f98c5573495a07be2325faf34efecdb) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Document how to run several instances on one Cloudflare account.

## 0.2.0

### Minor Changes

- [`46c886b`](https://github.com/pouchbase/pouchbase/commit/46c886b5281df2a34977b6bb5405968212a691b3) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add a documentation section at `/docs`, starting with a getting started guide for self-hosting on Cloudflare Workers, with Docker or as a single binary.

## 0.1.0

### Minor Changes

- [`34df8b8`](https://github.com/pouchbase/pouchbase/commit/34df8b8aead2af3aded76298946d7bd321f87c06) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - First release of pouchbase.io from the Pouchbase repository. The self-hosting guide deploys to Workers with `--secrets-file .env`.
