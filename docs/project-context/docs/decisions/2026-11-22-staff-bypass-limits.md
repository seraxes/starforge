---
kind: decision
last_verified: 2026-11-22
---
# Decision: staff bypass limits (edit/delete/moderation vs private read)

**Date:** 2026-11-22

**Decision:** Staff may see private front-end content. This supersedes any reading of [2026-11-21-staff-bypass](./2026-11-21-staff-bypass.md) that would hide private content from staff. Developer is the highest role and can open anything, including environment files. Admin is lower (permission matrix later). Manager will be defined later. Moderator has no backend access. On the front end, moderator, admin, and developer can see private content (including only-me and friends-only) and can edit, delete, and moderate as the owner can. Do not invent the admin or manager permission matrix in this change. Private-read is implemented via the existing Social staff grant in `canViewPost` (Open work closed on the live map).

**Status:** accepted

**Supersedes:** Readings of [2026-11-21-staff-bypass](./2026-11-21-staff-bypass.md) that would hide `only_me` / friends-only / private content from staff. Does **not** withdraw the 2026-11-21 edit/delete/moderation bypass. Rejects proposed option **S1** (moderate without private read).

**Constraint (one sentence an agent can follow):** Keep additive staff edit/delete/moderation per `sf-staff-bypass.mdc`; front-end private-read for moderator/admin/developer uses the same Social staff grant in `canViewPost` (and feed / media peers); do not invent admin/manager matrices.

**Consequences:**

- Edit/delete/moderation staff bypass stays as today (code already allows app admin / pack staff).
- Private-read for staff/moderator is in `canViewPost`, feed predicate/SQL, and media serve via `canManagePosts`.
- Role hierarchy (developer > admin > manager > moderator) is accepted direction; only developer-vs-admin env/script gates are clearly coded today.

**Verification:** Social `canViewPost` / feed tests show the staff grant can see `only_me` and friends-only; a normal member cannot. Open work row Done on the live map. Private-read law added to `sf-staff-bypass.mdc`.

**Choice (recorded):** Not S1. Staff (moderator, admin, developer on the front end) may read private content and may edit/delete/moderate as the owner. Developer highest (including Environment). Admin lower — matrix later. Manager later. Moderator — no backend.

**Facts (current):**

- `canViewPost` grants staff private-read for `only_me` / friends / group when `canManagePosts` is true (same grant as edit/delete). Block and author-hidden still deny.
- App admin / `admin.social` edit get additive edit/delete/moderation and private-read via `canManagePosts`.

**Files to update:**

- Rule: `.cursor/rules/sf-staff-bypass.mdc` (private-read law when code complies)
- Live map: Open work private-read Done; Accepted transitions Staff bypass row
- Owner README: `src/modules/social/README.md`
