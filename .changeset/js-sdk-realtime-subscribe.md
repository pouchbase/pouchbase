---
'@pouchbasejs/js-sdk': minor
---

Breaking: `pouch.live.watch()` is now `pouch.realtime.subscribe()`, `pouch.db.<name>.watch()` is `pouch.db.<name>.subscribe()` and `pouch.session.watch()` is `pouch.session.subscribe()`; a subscription ends with `unsubscribe()` instead of `stop()`, the client connects to `/api/realtime`, and the types are renamed (`RealtimeService`, `RealtimeConnection`, `RealtimeEvent`, `RealtimeSubscription`, `RealtimeAction`, `SubscribeOptions`); `pouch.realtime.subscribe()` is typed by the schema like `pouch.db.<name>.subscribe()` (topics, `where`, `select`, `include` and events)
