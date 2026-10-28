---
'pouchbase': minor
---

Breaking: API keys no longer have a scope: every key, the key of a function too, acts as an admin and reaches the whole API (the records API without API rules, hidden fields, the schema, the types, email and realtime); the New API key dialog no longer asks for one. Only the key of a plugin stays limited to its collections in the records API
