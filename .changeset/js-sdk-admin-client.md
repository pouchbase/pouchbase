---
'@pouchbasejs/js-sdk': minor
---

Breaking: `pouch.asService()` is removed: a client with an `apiKey` sends the key instead of the session's token on every request and realtime connection, so it acts as an admin without a separate client
