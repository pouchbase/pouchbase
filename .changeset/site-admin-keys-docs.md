---
'pouchbase-site': patch
---

Document that every API key acts as an admin and that a client with an `apiKey` uses it on every call, without scopes or `pouch.asService()`; the site reads its key from `POUCHBASE_API_KEY` instead of `POUCHBASE_SERVICE_KEY`
