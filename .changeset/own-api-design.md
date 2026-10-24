---
'pouchbase': minor
---

Breaking: redesign the public API. Records move to `/api/db/<collection>` (`where`, `order`, `select`, `include`, `limit`, `offset` → `{ items, total, limit, offset }`), the schema to `/api/schema`, live updates to `/api/live`, and the password and email routes to `/api/auth/password/forgot|reset` and `/api/auth/email/send-verification|verify`. Conditions and API rules use a new syntax (`author == $user.id and any(tags) == "news"`), thumbnails are `100x100:fit` via `?size=`, and existing rules, thumbnail sizes and export files are upgraded automatically.
