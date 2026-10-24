# pouchbase-site

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
