---
'pouchbase': minor
---

Breaking: functions have the JS SDK on `ctx`, with no bundling: `ctx.pouch` acts as an admin with the function's API key and knows the caller from the request's token (`ctx.pouch.auth.me()` is the signed-in user). `pouchbaseUser(request)` is removed, so existing functions must be changed and deployed again
