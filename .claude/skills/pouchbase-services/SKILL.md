---
name: pouchbase-services
description: Project rules for server-side logic in Pouchbase. MUST be loaded before writing or changing anything in src/lib/server, a *.remote.ts file, a hook, +page.server.ts or +server.ts. Covers the services pattern (classes extending Service, the Services registry on locals), neverthrow ResultAsync return types, ServiceError codes, and how callers turn errors into error()/invalid()/redirect().
---

# Pouchbase services

All server-side business logic lives in **services**. Routes, remote functions and hooks never touch
the database, the Cloudflare API or crypto directly; they call a service and handle its `Result`.
(Same pattern as cuespark, `site/src/lib/server/services`.)

## Layout

```
src/lib/server/
├── platform/               # infrastructure: the DatabaseDriver and StorageDriver per platform (throw)
│   ├── types.ts            # driver interfaces, PlatformError
│   ├── index.ts            # the drivers in use: re-exports ./cloudflare (there are no others;
│   │                       # the data always lives on D1 and R2, also when self-hosting on Node)
│   ├── cloudflare/         # D1, R2 and function Workers over the Cloudflare REST API (works
│   │                       # from Workers and Node)
│   └── s3/                 # createS3Storage(): uploads in an S3-compatible bucket (Storage page)
├── db/query.ts             # raw queries on top of the database driver: `pouchbase` = system DB;
│                           # the app DB has a random name (id and name in settings)
├── db/                     # Drizzle schema, client and migrator (throws)
├── crypto.ts               # password hashing, tokens (throws)
├── plugins/                # running plugin server code (throws; used by plugins.service.ts)
│   ├── runtime.ts          # PluginRuntime, the calls (describe, profile), dispatch, zod schemas
│   ├── network.ts          # hostMatches/restrictedFetch: the permissions.network allowlist
│   ├── worker.ts           # the Worker of an installed plugin: entry code, WorkerRuntime
│   └── embedded.ts         # built-in plugins from /plugins/* (import.meta.glob), InProcessRuntime
├── hooks/                  # boot.ts, session.ts, guard.ts → sequence() in src/hooks.server.ts
└── services/
    ├── api-keys.service.ts # API keys for server-side code (`pbk_…`); every function has one
    ├── auth.service.ts
    ├── backups.service.ts  # backups to S3-compatible buckets, schedules and restores
    ├── base.service.ts     # ServiceError type + Service base class
    ├── cloudflare.service.ts # dashboard overview of the Cloudflare account (resources, usage, limits)
    ├── services.ts         # Services registry (one method per service)
    ├── collections.service.ts
    ├── database.service.ts
    ├── environments.service.ts # development/production: snapshots of the schema and plans between instances
    ├── fields.service.ts
    ├── files.service.ts
    ├── functions.service.ts # serverless functions: one Worker each, versions, secrets, logs
    ├── indexes.service.ts
    ├── install.service.ts
    ├── mail.service.ts     # mail settings and sending (Cloudflare Email Service or SMTP)
    ├── mail-templates.service.ts # email templates with variables, the built-in emails, sending them
    ├── oauth-providers.service.ts # sign-in providers (from plugins: plugin_auth_providers) and their credentials
    ├── plugins.service.ts  # plugins: registry search, install (Worker deploy, sign-in providers),
    │                       # remove, built-in plugins, runtimeFor(), asset()
    ├── realtime.service.ts # realtime events: sessions, subscription and view-rule checks for the hubs
    ├── records.service.ts
    ├── sessions.service.ts
    ├── settings.service.ts
    ├── storage.service.ts  # uploads: R2 by default, or the S3 bucket from the settings
    ├── types.service.ts    # TypeScript types of the collections, and the token of /api/types
    ├── updates.service.ts  # updates of Pouchbase itself (latest release, Worker self-deploy, binary)
    └── users.service.ts
```

Infrastructure modules (`platform/`, `db/`, `crypto.ts`) are plain functions that **throw**.
Services never import a driver directly: they use `db/query.ts` (`queryDatabase`, `rawQuery`, ...)
or `storage`/`insights`/`functions` from `../platform`, so the same code runs on Workers and on Node.
Services are the boundary where throwing code is wrapped into `ResultAsync`.

## Writing a service

- File: `src/lib/server/services/<plural-domain>.service.ts`, class `<Domain>Service extends Service`.
- Register it in `services.ts` with a method that returns a new instance:

  ```ts
  export class Services {
  	users() {
  		return new UsersService();
  	}
  }
  ```

- `Service` reads the current request via `getRequestEvent()` in its constructor and exposes:
  - `this.ctx` — the `RequestEvent` (cookies, locals, url, ...)
  - `this.db` — the Drizzle database
  - `this.services` — the registry, for services that build on other services
  - `this.error(code, message, error?)` — builds a `ServiceError`
- Pure helpers go as non-exported functions above the class; multi-step private logic as `private`
  methods.
- Import order: type imports, external packages, `$app`/`#lib` imports, relative imports.

## Writing a method: `run()`, `fail()`, `must()`

Every public method returns `ResultAsync<T, XError>` with an explicit return type, where `XError`
is the service's error union (one `type XError = ...` per service, see below). The body is **one**
`this.run()` around an `async` function that reads top to bottom with `await`:

```ts
create(name: string, input: FieldInput): ResultAsync<Field, FieldsError> {
	return this.run(
		async () => {
			const collection = await this.requireCollection(name); // private helper, throws
			const settings = this.settings(input); // pure, throws or returns

			if (settings.issues) {
				this.fail(7001, 'INVALID_FIELD', { data: settings.issues });
			}

			const { id } = await this.must(this.services.database().requireApp());
			await queryDatabase(id, `ALTER TABLE ...`);

			return this.insertField(collection, input);
		},
		(error) => this.error(7000, 'CREATE_FIELD_FAILED', error)
	);
}
```

- `this.run(work, onError)`: the value becomes `Ok`; a `Failure` thrown inside becomes that
  error; anything else thrown (D1, the Cloudflare API, a bug) becomes `onError(error)`, the
  method's own `..._FAILED` code, with the cause as `reason`.
- `this.fail(code, message, { data?, cause? })`: throws an expected failure the caller reacts
  to (`INVALID_FIELD`, `COLLECTION_NOT_FOUND` when the caller needs it as an error, ...).
- `this.must(result)`: the value of another service's result; its error becomes this method's
  error, so include that service's codes (or `ContextError`) in `XError`.
- Private helpers are plain `async` functions that **throw** (`Failure` via `fail()` for
  expected cases, anything for unexpected ones). They never return `ResultAsync`; only public
  methods do. Pure helpers go as non-exported functions above the class or in a module next to
  the service (`services/<domain>/*.ts`) when the service grows past ~400 lines.
- **Not found is `Ok(null)`**, not an error. The caller decides whether that is a 404.
- Never nest `.andThen()` chains; never use `_unsafeUnwrap` outside tests.

## ServiceError codes

`{ code: number; message: 'UPPER_SNAKE_CASE'; data?: unknown }`. Codes are **unique across the
app**; each service owns a range:

| Range | Service    |
| ----- | ---------- |
| 1000  | database   |
| 2000  | install    |
| 3000  | users      |
| 4000  | sessions   |
| 5000  | settings   |
| 6000  | collections |
| 7000  | fields      |
| 8000  | records     |
| 9000  | indexes     |
| 10000 | oauth providers |
| 11000 | auth (app users) |
| 12000 | storage (uploads) |
| 13000 | files |
| 14000 | cloudflare (dashboard overview) |
| 15000 | mail |
| 16000 | backups |
| 17000 | types (TypeScript types of the collections) |
| 18000 | functions (serverless functions on their own Workers) |
| 19000 | plugins (plugin registry, installed plugins) |
| 20000 | environments (development and production instances, snapshots, plans) |
| 21000 | updates (updates of Pouchbase itself: the latest release, Worker self-deploys, the binary) |
| 22000 | realtime (record events over WebSockets; what the hubs ask through `/internal/realtime/*`) |
| 23000 | API keys (secret keys for server-side code; one per function) |
| 24000 | mail templates (email templates with variables, sent through `/api/mail/send`) |

A new service takes the next free range (6000, 7000, ...). Never reuse a code.

Declare the union once per service and use it in every signature instead of repeating codes:

```ts
export type FieldsError =
	| ContextError // 1004 APP_DATABASE_MISSING, 5000 GET_SETTING_FAILED (from base.service)
	| ServiceError<6006, 'COLLECTION_NOT_FOUND'>
	| ServiceError<7000, 'FIELDS_FAILED'>
	| (ServiceError<7001, 'INVALID_FIELD'> & { data: FieldIssues });
```

One `..._FAILED` code per service is enough for the unexpected errors (the `reason` says what
broke); only failures a caller branches on get their own code.

## Calling services

Always go through `locals.services` (in remote functions: `getRequestEvent().locals.services`).
`await` the result, check `isErr()`, map the error explicitly, then use `result.value`:

```ts
export const login = form(loginSchema, async (data) => {
	const { locals } = getRequestEvent();

	const result = await locals.services.sessions().login(data.username, data._password);

	if (result.isErr()) {
		if (result.error.code === 4003) {
			invalid('Invalid username or password');
		}

		error(500, result.error.message);
	}

	redirect(303, '/');
});
```

- Validation-type failures → `invalid(...)` (form-level) or `invalid(issue.field('...'))`.
- Forbidden/conflict states → `error(403, '...')`, not found (`Ok(null)`) → `error(404, '...')`.
- Anything unexpected → `error(500, result.error.message)`.
- `error()` and `redirect()` are called without `throw` (SvelteKit 3 style).
- User-facing messages are written in the caller, in English; the `UPPER_SNAKE` message is for logs.
