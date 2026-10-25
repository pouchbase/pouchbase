---
'@pouchbasejs/js-sdk': minor
---

Breaking: `pouch.auth.signIn()` is now `pouch.auth.login()`, `signInWithOAuth()` is `oauth()`, `signOut()` is `logout()` and `signUp()` is `register()`, with the types `RegisterInput` and `RegisterResult`; they call `/api/auth/password/login` and `/api/auth/password/register`.
