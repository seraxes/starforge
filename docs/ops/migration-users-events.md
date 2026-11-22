---
kind: reference
last_verified: 2026-11-22
---
# Migration — users and events (launch scope)

Accepted decision: [2026-11-22-launch-scope](../project-context/docs/decisions/2026-11-22-launch-scope.md). Live map: [architecture-current](../project-context/docs/architecture-current.md) § Launch scope.

## In scope (cutover requirement)

| Migrate | Do not migrate |
| --- | --- |
| Users | Passwords (person sets a **new password on first login**) |
| Avatars | Past events (stay archived on the old site) |
| Profile settings | Everything else not listed here |
| Upcoming events only | |
| Marketplace **user ratings** | Marketplace **posts** (later examination, not a cutover requirement) |

## Starforge destination tables (from schema)

Named only where a schema exists in-tree:

| Concern | Table(s) | Schema source |
| --- | --- | --- |
| User identity (email, name, role, …) | `sf_users` | `src/core/db/schema.ts` |
| Credential password hash | `sf_accounts.password` | Same file — **do not import old passwords**; leave unset / use first-login reset via Better Auth (`/forgot-password` exists) |
| Public persona / profile settings | `sf_profiles` (handle, displayName, bio, visibility, locale, timezone, links, extensions, …) | `src/modules/profiles/schema.ts` |
| Avatar (and cover) media id on profile | `sf_profiles.avatar_media_id` / `cover_media_id` | Profiles schema; binary + asset row → media store |
| Media asset rows | `sf_media_assets` (+ categories/owners as needed) | `src/modules/media/schema.ts`; bytes via local `/media` or S3 |
| Upcoming events | `sf_events` (and related `sf_venues`, tiers, … only if the export needs them) | `src/modules/events/schema.ts` — filter to upcoming (`starts_at` / status rules = TODO(owner) once export is known) |
| Marketplace user ratings | — | `product:marketplace` is a **Dashboard stub** with **no schema** yet (`src/modules/marketplace/README.md`). Destination rating table = TODO(owner) when a ratings schema ships. |

## Source (old site)

TODO(owner): source table names and field mapping — only after a real export is available. Do not invent Joomla/legacy column maps here.

## Marketplace posts

Examination later — not a cutover requirement. Past events and all other content stay on the old site.
