---
'pouchbase': minor
'@pouchbasejs/plugin-sdk': minor
---

Plugins can add functions: `functions` of `definePlugin` (or `pouchbase-plugin add function <name>`) adds `<plugin>-<name>`, called through `/api/functions/<plugin>-<name>` and `pouch.functions.invoke()` and listed on the Functions page. It runs in the plugin's Worker with the plugin's permissions, and only the plugin changes it
