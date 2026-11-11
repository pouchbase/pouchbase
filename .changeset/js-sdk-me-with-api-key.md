---
'@pouchbasejs/js-sdk': patch
---

`pouch.auth.me()` on a client with an `apiKey` sends the session's token, so it returns the signed-in user instead of ending the session
