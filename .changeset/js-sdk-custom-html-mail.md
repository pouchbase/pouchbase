---
'@pouchbasejs/js-sdk': minor
---

Breaking: `pouch.mail.send()` takes the template's name, or an email of your own (`{ subject, html, text? }`), as its first argument and the options as its second: `pouch.mail.send('welcome', { to, variables })`.
