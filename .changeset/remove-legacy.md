---
'pouchbase': minor
---

Breaking: drop the old forms that were still accepted: API rules and `where` only take the current condition syntax (no `contains` operator, `$now` or the syntax before 0.9, and saved rules are no longer upgraded), thumbnail sizes only `WxH:mode`, `/api/files/<id>` only `?size=` (not `?thumb=`), collection imports only export format 2, and the registry only `POUCHBASE_REGISTRY_URL` (not `PLUGIN_REGISTRY_URL`)
