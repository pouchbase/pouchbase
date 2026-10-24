---
'@pouchbasejs/js-sdk': minor
---

Breaking: follow the redesigned API. The auth store is replaced by `pouch.session` (`session: 'browser'` or your own `SessionStorage`), `send()`/`buildUrl()` are `request()`/`url()`, the password and email methods are `sendPasswordReset()`, `resetPassword()`, `sendVerification()` and `verifyEmail()`, `collections` is `schema`, `realtime.subscribe()` is `live.watch()` (and `db.<name>.watch()`, stopped with `stop()`), the `filter` tag is `condition`, and `findMany()` pages with `limit`/`offset`.
