---
'pouchbase': minor
---

Realtime accepts an API key as the `auth` token: the socket acts as an admin, so the view rules don't apply; an invalid key or the key of a plugin is closed with `4401` and a reason that says why
