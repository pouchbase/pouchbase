---
'pouchbase': minor
---

Run everything plugins contribute: their routes under `/api/plugins/<id>/` (with `ctx.user`, `ctx.admin` and route parameters), their pages in the dashboard with sidebar links, icons and their own layout (the reading width, the full width, or all of the space below the top bar), their field types in collections (input, preview, validation, default values, icons; fields of a removed plugin stay read-only with their data), and their settings, which admins fill in on the Plugins page. Components are compiled when a plugin is installed, and the install dialog lists what a plugin adds. In development (`vite dev`), installed plugins run their server code inside Pouchbase instead of in a Worker, so `ctx.pouch` reaches a Pouchbase on `localhost` and installing needs no deploy.
