---
'pouchbase': minor
---

On Node, Docker and the single binary, queries go through a small D1 gateway Worker (`<instance>-gateway`) with bindings for the databases, instead of the rate-limited D1 HTTP API.
