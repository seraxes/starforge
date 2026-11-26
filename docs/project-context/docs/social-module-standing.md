---
kind: reference
last_verified: 2026-11-25
---
# product:social — standing brief (for second opinion)

**Date:** 2026-11-21  
**Purpose:** Self-contained status of Social so another agent (or human) can give a second opinion.  
**Authority:** This file is a briefing. It does **not** change the live queue. [architecture-current](./architecture-current.md) still wins. The build plan is [social-feed-plan](./social-feed-plan.md). Owner map: [src/modules/social/README.md](../../../src/modules/social/README.md).

---

## One-line verdict

**Social’s planned MVP is largely implemented in-tree** (slices 1–22 + admin panels + composer stage), **default-off**, with **unit tests registered**. Enablement blockers on the live map are **Done**. The live map’s **Active** lane is **Social polish and complete**; **Next** is Marketplace. Ads stays parked. Treat Social as an **in-scope advanced pack to finish**, not as production-polish complete yet.

---

## Queue (read this first)

| Source | What it says |
| --- | --- |
| **Live map** (`architecture-current`) | **Active:** Social polish and complete. **Next after Social:** Marketplace. Ads parked until after Marketplace (and other major advanced modules). |
| **Accepted decisions (2026-11-22)** | Launch scope includes Social; continue Social work; no Payments/Maps hard requires; comments/reports stay in Social; media access + staff private-read are accepted policy with Open work where code lags. |
| **`social-feed-plan.md` header** | May still say parked historically. Plan is the build spec; the live map wins. |
| **Code + pack README** | Slices **1–22** documented as shipped. `defaultEnabled: false`. Full `sf_social_*` schema present. |

**Implication for a second opinion:** The code already exists. Enablement blockers (media access, rate limits, staff private-read) are closed on the live map. Remaining work is polish / Open work leftovers (`form` optionalRequires, event/page conversation UI, UX) before Airsoft Nexus turns Social on.

---

## Placement and ownership

| Item | Standing |
| --- | --- |
| Pack id | `product:social` |
| Layer | Advanced (`layer: 'advanced'`) |
| Public surface | `/feed…` (not Core; not Hero) |
| Admin | `/admin/social`, `/people`, `/groups`, `/pages`, `/media`, `/reports` |
| Public doors | `@/modules/social/api`, `@/modules/social/api.server` (`social-api`, `social-api-server`) |
| Builtin particle `social` | Footer links — **do not reuse**. Social particles are `social-friends`, `social-groups`, `social-pages`, `social-stories` |
| Live video | Part of Social. No `product:stream`. Not a separate pack after Marketplace ([2026-11-26-chat-shop-stream](./decisions/2026-11-26-chat-shop-stream.md)) |
| Money | Payments is **not** a Social dependency; **no Social cart**; no Social charge path yet |
| Mail | Email Manager triggers only (`emitEmailTrigger`); never `getMailer()` |
| Media / forms / profiles / rich-editor | Consumed via owners; bytes stay in Media |
| Maps | Check-in uses Core `MapProvider`; `product:maps` (TacMap) is for events — not a Social require |
| Comments / likes / reports | Owned here; no `product:comments` / `product:reports` |
| Hero extras | `extensions` jsonb on posts/albums/etc. — not new `sf_social_*` columns |

**Hard `requires`:** profiles, media, rich-editor, forms, email-manager.  
**`optionalRequires`:** `product:subscriptions`, `product:events`, and particle id `form` (keep-or-drop still Open work).

---

## What is shipped (code claims vs plan)

Owner README lists slices **1–22** as done. Summary:

### Core social graph and feed

- Friends: request / accept / decline / cancel / unfriend / block; one row per unordered pair; dual blockers (`blockedBy` / `blockedByOther`).
- Posts: audiences `only_me` | `group` | `friends` | `public`; `canViewPost` as sole post read check; permalink + reserved handles.
- Home feed: SQL visibility predicate matched to `canViewPost`, then paginate (parity tests in `feed-query.test.ts`).
- Composer stage (first pass): in-place feed card; instruments photo / link / vote / place; one block at a time; Challenge and Watch chips **still later**.
- Media binds: ≤10 images or one video, not both; files stay in Media.
- Reactions: catalog `like|love|haha|wow|sad|angry`; unique `(actor, targetType, targetId)`; comments when pack switch on; `canInteract` write gate.
- Comments: two reply levels; author edit/delete; staff hide; cascade on post delete.
- People directory; Following tab; Discover (public only); Watch short-video layout (`/feed/watch`); Saved; tag feeds; Mentions.

### Trust / account

- Reports on posts (optional comment); review queue; resolve hide/dismiss; auto-hide threshold.
- Social ban via `sf_social_members.bannedAt` (not a Core role).
- Account doors: `exportOwnSocialRecord` / `hideOwnedSocialContent` / `purgeOwnSocialRecord` on `social-api-server`.
- Core retention already lists those door methods (`account-retention-store.ts`).

### Groups, pages, stories, albums, challenges

- Groups: categories `general|team|association`, membership, wall, invite mail, particle.
- Team tools: ranks, Media documents, announcements, Forms `formDefinitionId`.
- Pages: admins, likes, wall, `verifiedAt`, optional `sitePageId`, particle.
- Events calendar tab on group/page when Events is on (`hostModule = product:social` via Events door — no second calendar inside Social).
- Stories: lifetime from pack settings (default 24h), views, sweep expiry on same job.
- Albums: member / group / page; Media binds.
- Challenges: timing rules, multi-invite entitlement `social.challenge.multi`, challenge likes table (not reactions), `social.sweep`.

### Admin (EasySocial-style pack switches)

- `/admin/social` composer/feed, `/people`, `/groups`, `/pages`, `/media`, `/reports`.
- One `sf_module_settings` document (`product:social`); panel saves merge fields.

### Activity door

- `publishActivity` on the Social door (off → no write; errors soft-fail).
- **Callers in Events / Pages are not wired yet** (plan said those are separate chats). Switches for `event.published` / `page.published` exist on the Social side with no publisher.

### Slice 23 (explicitly later)

- Gamification `recordAction`, Search index, Notifications triggers, Chat story replies — only when those packs exist.

---

## Schema footprint (`sf_social_*`)

Roughly **30 tables**, including:

friendships, posts, post_media, reactions, comments, members, reports, activities, challenges + entries + challenge_likes, group_categories, groups, group_members, group_ranks, group_documents, pages, page_admins, page_likes, stories, story_views, albums, album_items, follows, saves, post_tags, mentions, poll_votes.

User / media / group / page ids are **plain text** (no cross-pack FKs). Unique keys match the plan’s Uniqueness list.

---

## Tests and gates

- **~35** `*.test.ts` files under `src/modules/social`.
- Registered in `package.json` `test:unit` (door through media-admin-settings, plus boot).
- Slice rule: touching manifest / schema / public door → `npm run check:atomic`.
- Default off: routes/particles/sweep do nothing when Social is disabled.

---

## Known gaps and tensions (opinion targets)

These are the main places a second opinion should push back or confirm.

### 1. Live map vs disk — decided

Finish Social polish before Marketplace; Ads stays parked ([2026-11-22-social-built-parked](./decisions/2026-11-22-social-built-parked.md) still says Social-before-Ads — live map wins on queue). Default-off until polish / cutover. Airsoft Nexus includes Social ([2026-11-22-launch-scope](./decisions/2026-11-22-launch-scope.md)).

### 2. Comments / reports — decided

Social owns the comments engine, likes, and reports. No `product:comments` / `product:reports`. Pages/events may opt into Social’s conversation engine when Social is on ([2026-11-22-comments-reports-ownership](./decisions/2026-11-22-comments-reports-ownership.md)). Archive [core-finish-instructions](../../archive/core-finish-instructions.md) rows naming those packs are historical.

### 3. Cross-pack wiring incomplete

| Edge | Status |
| --- | --- |
| Events / Pages → `publishActivity` | Door ready; **no callers** |
| Events host calendar on group/page | Social lists/links via Events door; host fields exist on Events |
| Subscriptions entitlement `social.challenge.multi` | Gate exists; depends on Subscriptions being on |
| Core retention hide/purge | Doors registered on Core side |
| Media access — attach (refuse wider-audience bind) | Done (`audience_too_wide` on create / set audience) |
| Media access — serve (`/api/media/[id]` honors owning audience) | Done; routes call Social `decideSocialMediaServeAccess` before redirect/bytes |
| Staff private-read | Accepted policy; `canViewPost` does not grant it yet |
| Payments charge from Social | Not a Social dependency; no Social cart |
| Notifications / Search / Gamification / Chat | Slice 23 — packs absent or parked |

### 4. Product polish leftovers (not new slices, but unfinished UX)

- Composer: Challenge instrument and Watch chip not in the stage pass.
- `/feed/requests` is still a stub that redirects to People.
- Schema comment still says reaction `targetType` “comment later” in places while comment reactions are already implemented — doc drift.
- Manifest `optionalRequires` includes `'form'` (suspicious next to `product:forms` in `requires`).
- Hold-new-posts-for-review sets `staffHidden` on create; there is no separate “pending review” workflow beyond that flag + reports queue.
- Plan duplicate text on stories slice (cosmetic in the plan file).

### 5. Size vs commercial priority — dependency floor decided

Social is one of the largest packs. Hard `requires` are Profiles, Media, Rich editor, Forms, Email Manager only — Payments and Maps removed ([2026-11-22-social-dependency-floor](./decisions/2026-11-22-social-dependency-floor.md)). Enabling Social is still a platform enable of those base packs, not a light feature flag.

### 6. What Social deliberately does not own

Per plan / README: points/badges, support tickets, chat (its own pack after Marketplace), notification bell, Profiles field schema, Email templates, Payments cart, Maps rooms, Hero airsoft columns. Keep those out. Live video stays in Social; there is no `product:stream`.

---

## Surfaces cheat sheet

| Kind | Paths / ids |
| --- | --- |
| Public | `/feed`, `/feed/people`, `/feed/groups`, `/feed/g/[slug]`, `/feed/pages`, `/feed/p/[slug]`, `/feed/stories`, `/feed/following`, `/feed/discover`, `/feed/watch`, `/feed/saved`, `/feed/tag/[tag]`, `/feed/post/[id]`, `/feed/[handle]`, `/feed/u/[handle]` |
| Admin | `/admin/social` (+ people, groups, pages, media, reports) |
| Particles | `social-friends`, `social-groups`, `social-pages`, `social-stories` |
| Job | `social.sweep` (challenges + story expiry) — armed only when Social enabled |
| Mail triggers | `product:social/friend.requested`, `group.invited`, `group.announced`, `challenge.invited` |
| Grants (planned shape) | `social.posts`, `social.reports` at view/edit/manage — plus admin area `admin.social` used in comment staff paths |

---

## Remaining questions (post 2026-11-22 decisions)

1. Priority among Open work: staff private-read, Social write rate limits, `'form'` optionalRequires keep/drop, Events/Pages `publishActivity` callers, composer Challenge/Watch chips.
2. Any slice-22+ surface that should stay switch-off forever for ASN (short-video Watch, Discover, Challenges)?
3. Admin / manager permission matrices (deferred; do not invent in Social).

---

## File map for reviewers

| Path | Role |
| --- | --- |
| [architecture-current.md](./architecture-current.md) | Live queue (wins) |
| [social-feed-plan.md](./social-feed-plan.md) | Slice build plan (parked header) |
| [platform-module-layers.md](./platform-module-layers.md) | Advanced placement |
| [core-finish-instructions.md](../../archive/core-finish-instructions.md) | `product:comments` / `product:reports` rows |
| [src/modules/social/README.md](../../../src/modules/social/README.md) | Owns / Consumes / Shipped |
| [src/modules/social/manifest.ts](../../../src/modules/social/manifest.ts) | Routes, nav, doors, requires |
| [src/modules/social/schema.ts](../../../src/modules/social/schema.ts) | All `sf_social_*` tables |
| [src/modules/social/api.ts](../../../src/modules/social/api.ts) / [api.server.ts](../../../src/modules/social/api.server.ts) | Public doors |

---

## Explicit non-goals of this brief

- Does not ask another agent to implement anything.
- Does not change the live map or queue.
- Does not declare Social “production ready.”
- Does not start Marketplace, Ads, Chat, Stream, or Notifications (queue lives on the live map).
