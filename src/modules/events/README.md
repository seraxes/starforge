# product:events

Events + venues Module pack (`sf_venues` / `sf_events`).

## PR1 (this pack)

- Drizzle schema + migration (`0004_events_venues`)
- Admin CRUD: `/admin/events`, `/admin/events/venues`, `/admin/events/settings`
- ACL viewing tags (`public` / `registered` / `group:<id>`) via `AccessTagsField`
- Media cover via shared `MediaPicker` (`mediaId`)
- Module settings (`defaultTimezone` in `sf_module_settings`)
- Dashboard `events.upcoming` — real published upcoming / this-week counts
- Toggle: Site Settings → Modules (`product:events` allowlisted)
- Messages: `messages/{en,hu}.json` (`product:events` namespace)

## Later

- **PR2:** public particles (`event-list` / `event-detail`), Nav views
- **PR3:** Forms `event-registration` + Email Manager `events.registered`
- Ticket tiers, Maps pins, AI draft description
