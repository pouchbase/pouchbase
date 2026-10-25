---
'pouchbase': minor
---

Conditions follow relations: `author.role == "admin"`, `post.author.name` and `any(editors.role) == "admin"` compare fields of related records, up to three relations deep, in API rules, `where` and realtime subscriptions; in `where` the related records are checked against the view rule of their collection, and the rule editor suggests and checks the related fields
