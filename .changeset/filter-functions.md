---
'pouchbase': minor
---

Conditions in API rules and `where` get functions: `contains()`, `starts_with()`, `ends_with()`, `like()`, `lower()`, `length()`, `count()`, date functions such as `now()`, `today()`, `date_add()`, `start_of()`, `year()` and `weekday()`, and `not`; `contains` and `not contains` became `contains(title, "x")` and `not contains(title, "x")`, `$now` became `now()`, and Created and Updated fields now compare with dates such as `"2026-01-01"`
