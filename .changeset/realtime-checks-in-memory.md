---
'pouchbase': patch
---

Realtime checks the view rule of an event in memory and once per group of subscribers it can't tell apart, instead of one database query per subscriber, so collections with many live subscribers stay fast
