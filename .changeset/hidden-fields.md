---
'pouchbase': minor
---

Add hidden fields: a field marked hidden is only seen by admins, API keys, plugins and API rules; the records API, includes, realtime events and `/api/auth/me` leave it out for app users, who can't filter, sort, select or write on it either
