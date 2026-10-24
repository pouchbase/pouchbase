---
'pouchbase': patch
'@pouchbasejs/plugin-sdk': patch
'pouchbase-site': patch
---

The plugin registry of an instance is set with `POUCHBASE_REGISTRY_URL`, the same variable `pouchbase-plugin publish` reads; `PLUGIN_REGISTRY_URL` still works when it isn't set.
