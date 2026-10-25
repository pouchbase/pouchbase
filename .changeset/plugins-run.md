---
'pouchbase': minor
---

Run everything plugins contribute: their routes under `/api/plugins/<id>/` (with `ctx.user`, `ctx.admin` and route parameters), their pages in the dashboard with sidebar links and icons, their field types in collections (input, preview, validation, default values, icons; fields of a removed plugin stay read-only with their data), and their settings, which admins fill in on the Plugins page. Components are compiled when a plugin is installed, and the install dialog lists what a plugin adds.
