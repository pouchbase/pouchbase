---
'pouchbase': patch
---

Publishing or pulling new collections with a relation to another new collection no longer stops with `INVALID_RELATION`: the `id` fields of new collections are created first.
