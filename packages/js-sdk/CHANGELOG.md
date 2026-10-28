# @pouchbasejs/js-sdk

## 0.8.0

### Minor Changes

- [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Breaking: `pouch.asService()` is removed: a client with an `apiKey` sends the key instead of the session's token on every request and realtime connection, so it acts as an admin without a separate client

- [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Breaking: `pouch.auth.signIn()` is now `pouch.auth.login()`, `signInWithOAuth()` is `oauth()`, `signOut()` is `logout()` and `signUp()` is `register()`, with the types `RegisterInput` and `RegisterResult`; they call `/api/auth/password/login` and `/api/auth/password/register`.

- [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Breaking: `pouch.mail.send()` takes the template's name, or an email of your own (`{ subject, html, text? }`), as its first argument and the options as its second: `pouch.mail.send('welcome', { to, variables })`.

- [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - `where` sends `contains` and `notContains` as the `contains()` function of the condition syntax and adds `startsWith` and `endsWith`; needs Pouchbase 0.10 or later

- [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - `where` objects compile to conditions with `&&`, `||` and `!`, the new syntax of the API

- [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add `hidden` to the fields of `pouch.schema`, for fields that only admins and API keys see

- [`626a5db`](https://github.com/pouchbase/pouchbase/commit/626a5db5b635aa331c8b01a5e5ec59b71197bcb0) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Breaking: `pouch.live.watch()` is now `pouch.realtime.subscribe()`, `pouch.db.<name>.watch()` is `pouch.db.<name>.subscribe()` and `pouch.session.watch()` is `pouch.session.subscribe()`; a subscription ends with `unsubscribe()` instead of `stop()`, the client connects to `/api/realtime`, and the types are renamed (`RealtimeService`, `RealtimeConnection`, `RealtimeEvent`, `RealtimeSubscription`, `RealtimeAction`, `SubscribeOptions`); `pouch.realtime.subscribe()` is typed by the schema like `pouch.db.<name>.subscribe()` (topics, `where`, `select`, `include` and events)

- [`908eb96`](https://github.com/pouchbase/pouchbase/commit/908eb966c2c4b83c8e4efce10c72ecd1c64da9c6) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Breaking: remove `OAUTH_PROVIDERS`; use `KNOWN_OAUTH_PROVIDERS`

- [`540ea55`](https://github.com/pouchbase/pouchbase/commit/540ea55886916318645a396babd378cd7d995176) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Type `pouch.mail.send()` with the generated `MailTemplates`: `createClient<Schema, MailTemplates>(url, { apiKey })` checks template names and their (required) variables.

- [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Download the types with an API key: `pouch.schema.types()`, and `pouchbase types <instance url> --api-key pbk_…` (or `POUCHBASE_URL` and `POUCHBASE_API_KEY`); `pouchbase types` no longer saves a web page as the types when the URL has no token.

### Patch Changes

- [`6263212`](https://github.com/pouchbase/pouchbase/commit/626321289ded92e8d326d7aeacc3ccb5e19b8140) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Editors now suggest the relations of a collection in `include`, and an unknown relation there is a type error.

- [`ac9aa28`](https://github.com/pouchbase/pouchbase/commit/ac9aa28a36e533556ff3a59e8043933d0f5e0f38) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Type field types that come from plugins (`<plugin>:<type>`) in the schema API.

## 0.7.0

### Minor Changes

- [`2578b98`](https://github.com/pouchbase/pouchbase/commit/2578b98fa707dc84bc321901e8960960c50ecb9b) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Breaking: follow the redesigned API. The auth store is replaced by `pouch.session` (`session: 'browser'` or your own `SessionStorage`), `send()`/`buildUrl()` are `request()`/`url()`, the password and email methods are `sendPasswordReset()`, `resetPassword()`, `sendVerification()` and `verifyEmail()`, `collections` is `schema`, `realtime.subscribe()` is `live.watch()` (and `db.<name>.watch()`, stopped with `stop()`), the `filter` tag is `condition`, and `findMany()` pages with `limit`/`offset`.

## 0.6.0

### Minor Changes

- [`beca993`](https://github.com/pouchbase/pouchbase/commit/beca9932da720984cd97cbe52ade9b0ee323c65c) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add the `onDelete` option of relation fields (`set_null`, `cascade` or `restrict`) to `FieldOptions`

- [`3096c45`](https://github.com/pouchbase/pouchbase/commit/3096c457493558e9cd2df9fdad8f4d92b4e1e35e) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - `OAuthProvider` accepts any provider id, since sign-in providers now come from plugins, and `pb.auth.providers()` returns each provider's `iconUrl`. The built-in ids are `KNOWN_OAUTH_PROVIDERS` (`OAUTH_PROVIDERS` is deprecated).

## 0.5.0

### Minor Changes

- [`346ed1a`](https://github.com/pouchbase/pouchbase/commit/346ed1afcc5171bfa03b2f31e5b025244bd347e5) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - `pb.auth.signUp()` takes `{ name, email, password }` and returns `verificationRequired` (with `token: null`) when the instance requires a verified email, `pb.auth.signIn()` takes an email, and errors carry the API's `code`, such as `email_not_verified`.

## 0.4.0

### Minor Changes

- [`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add `pb.collections` to manage collections, their fields, indexes and API rules with a service API key, and to export and import them.

- [`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add `include` to record reads, `insert()`, `patch()` and `subscribe()`: `pb.db.posts.find(id, { include: { author: true } })` returns the related records instead of their ids, typed from the generated `Schema`, also nested (`{ comments: { include: { author: true } } }`).

- [`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add `pb.mail.send()` to send email templates, an `apiKey` option for server-side code such as functions (`env.POUCHBASE_API_KEY`), and `pb.asService()` to use the records API with a service key.

- [`103e69c`](https://github.com/pouchbase/pouchbase/commit/103e69c026a081c67b4697763fe51b7c6c3c8b1d) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add realtime: `pb.db.<name>.subscribe()` and `pb.realtime.subscribe()` call you with every change to records you may see, with `where`, `select` and `id`, over one WebSocket per collection that reconnects by itself and follows sign-ins.

## 0.3.0

### Minor Changes

- [`58ab82d`](https://github.com/pouchbase/pouchbase/commit/58ab82d2ec81c175c5b60d7f4754f32b8c0cde80) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - **Breaking:** `pb.collection()` and `pb.filter()` are replaced by `pb.db`, typed from the generated `Schema`: `pb.db.posts.findMany({ where, orderBy, select, limit })`, `find()`, `findFirst()`, `count()`, `iterate()`, `findAll()`, `insert()`, `patch()` and `remove()`. Conditions are objects (`{ views: { gte: 10 } }`) so values never need escaping, `select` narrows the result type, and inputs are checked against the `<Name>Create` types. Also new: `createClient<Schema>()`, the `filter` tagged template for hand-written filters, `.safe()` to get a result instead of an exception, and `kind` on `PouchbaseError` with `isPouchbaseError()`.

## 0.2.0

### Minor Changes

- [`bd0104a`](https://github.com/pouchbase/pouchbase/commit/bd0104afe288707cde47b6289b7a0f6723d3fab5) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add `pb.collection(name)` with `getList()`, `getFullList()`, `getFirstListItem()`, `getOne()`, `create()`, `update()` and `delete()` for the new records API, typed with the generated `Collections`, and `pb.filter()` to build filters with escaped values.

## 0.1.0

### Minor Changes

- [`8e5476f`](https://github.com/pouchbase/pouchbase/commit/8e5476f88d5052392fc6e104a8fc6d67ba9378c9) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add `pouchbase types <url>` and `fetchTypes()` to download the TypeScript types of your collections, and type the client with them: `new Pouchbase<Collections>(url)` types `pb.auth.me()` with the `users` record.

- [`8e5476f`](https://github.com/pouchbase/pouchbase/commit/8e5476f88d5052392fc6e104a8fc6d67ba9378c9) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - Add `pb.functions.invoke(name, options)` to call the serverless functions of a Pouchbase instance (`/api/functions/<name>`), with the signed-in user's token.

- [`8e5476f`](https://github.com/pouchbase/pouchbase/commit/8e5476f88d5052392fc6e104a8fc6d67ba9378c9) Thanks [@codeit-ninja](https://github.com/codeit-ninja)! - First release: password and OAuth sign-in, sign-up, password resets, email verification, `me()`, file URLs and a health check, with in-memory and `localStorage` auth stores.
