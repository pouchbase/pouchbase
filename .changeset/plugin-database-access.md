---
'pouchbase': minor
---

Give plugins access to data through `ctx.pouch`, the JS SDK signed in as the plugin with an API key of its own: Pouchbase creates the collections a plugin declares (`<plugin>_<name>`, deleted with their records when the plugin is removed) and lets it read and write those and the collections in its `permissions.collections`, which the admin sees before installing.
