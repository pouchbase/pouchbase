## Project Configuration

- **Project**: `@pouchbasejs/js-sdk`, the TypeScript SDK for the public API of [Pouchbase](https://github.com/pouchbase/pouchbase)
- **Language**: TypeScript (ESM only, no runtime dependencies)
- **Package Manager**: pnpm
- **Tooling**: tsdown (build to `dist/`), Vitest (`test/`), prettier, eslint, Changesets

## Language

Everything in this project is **English**: code, identifiers, comments, error messages, docs and commit messages.

## Related projects

The SDK is a workspace package in the Pouchbase repository; the app is at the repository root (`../..` from here):

| Project          | Path              | What it is                                                                      |
| ---------------- | ----------------- | ------------------------------------------------------------------------------- |
| Pouchbase        | `../..`           | The app (SvelteKit on Cloudflare Workers or Node) and the API this SDK talks to |
| pouchbase.io     | `../../site`      | Marketing site and docs; documents the SDK for end users                        |
| Pouchbase JS SDK | `.` (this folder) | Client for the public API, for browsers, Node, Deno, Bun and Workers            |

- **The app is the source of truth.** The public API lives in `../../src/routes/api/**/+server.ts` (helpers in `../../src/lib/server/api.ts`) and is documented in the _Public API_ section of `../../README.md`. Request bodies, response shapes, status codes and error messages in the SDK must match those files exactly; check them instead of guessing.
- Shared constants are mirrored in `src/types.ts`; keep them in sync when the app changes. Sign-in providers come from plugins, so `OAuthProvider` is any id; `KNOWN_OAUTH_PROVIDERS` lists the built-in ones (`../../plugins/auth-*`).
- Only call endpoints under `/api/`. Everything else in the app (remote functions in `*.remote.ts`, admin pages) is internal and can change at any time.
- When the API gains an endpoint, add it to the SDK with a test, and update the docs in `../../site` when they cover the SDK, in the same change.
- The app and the site have their own `AGENTS.md` and conventions; follow those when a change touches them.

## Public API (current)

Sign-ins return `{ token, user_id }`; the token is a JWT (HS256, 7 days) sent as `Authorization: Bearer <token>`. Sign-ups return `{ token, user_id, verification_required }`; `token` is `null` when the instance requires a verified email. Errors are JSON `{ message, code?, issues? }` where `code` is a machine-readable reason (such as `email_not_verified`) and `issues` maps an input field to a message. The API allows any origin (CORS `*`) and never uses cookies.

| Request                                                                                                | SDK                                                                              |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `GET /api/health`                                                                                      | `pouch.health()`                                                                 |
| `GET /api/auth/providers` (`[{ provider, label, iconUrl }]`)                                           | `pouch.auth.providers()`                                                         |
| `POST /api/auth/password/register`                                                                      | `pouch.auth.register()`                                                            |
| `POST /api/auth/password/login`                                                                      | `pouch.auth.login()`                                                            |
| `POST /api/auth/password/forgot` (`{ email }`)                                                         | `pouch.auth.sendPasswordReset()`                                                 |
| `POST /api/auth/password/reset` (`{ token, password }`)                                                | `pouch.auth.resetPassword()`                                                     |
| `POST /api/auth/email/send-verification` (`{ email }`)                                                 | `pouch.auth.sendVerification()`                                                  |
| `POST /api/auth/email/verify` (`{ token }`)                                                            | `pouch.auth.verifyEmail()`                                                       |
| `GET /api/auth/oauth2/<provider>?state=…&challenge=…`                                                  | `pouch.auth.oauth()` (popup)                                           |
| `POST /api/auth/oauth2/result`                                                                         | `pouch.auth.oauth()` (polls)                                           |
| `GET /api/auth/me`                                                                                     | `pouch.auth.me()`                                                                |
| `GET /api/db/<collection>?where&order&select&include&limit&offset` (`{ items, total, limit, offset }`) | `pouch.db.<name>.findMany()`, `findFirst()`, `count()`, `iterate()`, `findAll()` |
| `GET /api/db/<collection>/<id>?select&include`                                                         | `pouch.db.<name>.find()`, `findOrThrow()`                                        |
| `POST /api/db/<collection>?select&include`                                                             | `pouch.db.<name>.insert()`                                                       |
| `PATCH /api/db/<collection>/<id>?select&include`                                                       | `pouch.db.<name>.patch()`                                                        |
| `DELETE /api/db/<collection>/<id>` (`204`)                                                             | `pouch.db.<name>.remove()`                                                       |
| `GET /api/realtime?collection=<name>` (WebSocket; protocol mirrored in `src/realtime/protocol.ts`)     | `pouch.realtime.subscribe()`, `pouch.db.<name>.subscribe()`                      |
| `GET /api/files/<id>?size&download` (`size`: `WxH`, `WxH:top`, `WxH:bottom`, `WxH:fit`, `Wx0`, `0xH`)  | `pouch.files.url()`                                                              |
| `<method> /api/functions/<name>/<path>`                                                                | `pouch.functions.invoke()`                                                       |
| `POST /api/mail/send` (API key as `Bearer pbk_…`)                                                      | `pouch.mail.send()` (needs `apiKey`)                                             |
| `GET /api/plugins/<id>/assets/ui/<file>.svg` (public image, not JSON)                                  | not wrapped: used as an image URL                                                |
| Records API with a `service` API key (`Bearer pbk_…`; API rules skipped, other keys `403`)             | `pouch.asService().db.<name>…` (needs `apiKey`)                                  |
| `GET /api/schema` (service API key)                                                                    | `pouch.schema.list()` (needs `apiKey`)                                           |
| `GET /api/schema/<name>` (service API key)                                                             | `pouch.schema.find()`                                                            |
| `POST /api/schema` (`201`)                                                                             | `pouch.schema.create()`                                                          |
| `PATCH /api/schema/<name>?force`                                                                       | `pouch.schema.update()`                                                          |
| `DELETE /api/schema/<name>` (`204`)                                                                    | `pouch.schema.remove()`                                                          |
| `GET /api/schema/export?collections=a,b` (`{ format: 2, exportedAt, collections, related }`)           | `pouch.schema.export()`                                                          |
| `POST /api/schema/import?removeMissing&force&dryRun`                                                   | `pouch.schema.import()`                                                          |
| `GET /api/types?token=…` or with a service API key (text, not JSON)                                    | `fetchTypes()`, `pouch.schema.types()`, `pouchbase types`                        |

Conditions (`where`, API rules) use `==`, `!=`, `>`, `>=`, `<`, `<=`, functions such as `contains(field, "x")`, `starts_with()`, `ends_with()`, `lower()`, `now()` and `date_add()` (the list is in `../../src/lib/filter/functions.ts`), `any(field) == value`, `not`, `and`, `or` and `$user.<field>`; `src/query.ts` compiles `where` objects to them (`contains`, `notContains`, `startsWith` and `endsWith` become function calls). `order` is `created_at:desc,title:asc`.

## Code style

- `if`/`else` always use braces, even for a single statement (`if (x) { return; }`, never `if (x) return;`).
- Put a blank line before and after every `if` statement (unless it is the first or last statement in its block).
- Enforced by ESLint (`curly`, `padding-line-between-statements`); run `pnpm exec eslint . --fix` to apply.
- Tabs, single quotes, no trailing commas, 100 columns (Prettier, same as the app).
- The SDK must run everywhere `fetch` exists: no Node built-ins, no DOM access outside browser-only methods (`oauth`, `browserStorage()`), and no runtime dependencies.
- Public methods return promises and throw a `PouchbaseError` for non-2xx responses; "not found" for lookups is `null`, not an error. Record calls return a `Pending` (`pending()` in `src/error.ts`), so `.safe()` works on them.
- The records API is wrapped in our own terms (`pouch.db`, `where` objects, `find`/`insert`/`patch`/`remove`) with types from the generated `Schema`; don't copy another SDK's method names or shapes.
- Every exported function, class and type has a JSDoc comment; the declaration files are the reference docs.

## Changesets

Versioning and the changelog are managed with [Changesets](https://changesets.dev) from the repository root (`../../.changeset/`, see its README).

- Every new feature, bug fix or breaking change gets a changeset: run `pnpm changeset` or add a Markdown file to `../../.changeset/` by hand, with frontmatter `'@pouchbasejs/js-sdk': patch | minor | major` and a one-line, user-facing description in English.
- Create the changeset in the same change as the code, as part of the work, not afterwards.
- Do **not** create a separate changeset when the change belongs to work that already has an unreleased changeset in `../../.changeset/`: update that changeset's description if it no longer covers the change.
- Bump types: `patch` for bug fixes and small improvements, `minor` for new features, `major` for breaking changes. Internal refactors, docs and tooling changes need no changeset.
- Never run `pnpm changeset:version` unless asked.

## Checks

Run `pnpm check`, `pnpm test`, `pnpm lint` and `pnpm build` before finishing a change.
