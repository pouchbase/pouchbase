---
'@pouchbasejs/plugin-sdk': minor
---

Build plugins by convention: the CLI finds field types in `fields/`, pages in `pages/`, sign-in providers in `auth/` and routes in `routes/`, and writes the manifest itself (`pouchbase-plugin manifest` prints it). Settings are typed in `plugin.ts` with `definePlugin({ settings })`, `add` creates routes and settings, `validate` checks imports and compiles components exactly as Pouchbase does, field types and pages can have icons, and `@pouchbasejs/plugin-sdk/testing` provides `fakeContext()` for tests. Manifests with `contributes` still build, with a warning.
