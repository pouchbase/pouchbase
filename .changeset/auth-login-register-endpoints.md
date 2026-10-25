---
'pouchbase': minor
---

Breaking: the password endpoints are now `POST /api/auth/password/login` and `POST /api/auth/password/register` instead of `sign-in` and `sign-up`, and login no longer accepts `identity` instead of `email`.
