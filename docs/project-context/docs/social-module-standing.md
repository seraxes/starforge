# product:social — standing brief (for second opinion)

**Date:** 2026-11-21  
**Purpose:** Self-contained status of Social so another agent (or human) can give a second opinion.  
**Authority:** This file is a briefing. It does **not** change the live queue. [architecture-current](./architecture-current.md) still wins. The build plan is [social-feed-plan](./social-feed-plan.md). Owner map: [src/modules/social/README.md](../../../src/modules/social/README.md).

---

## One-line verdict

**Social’s planned MVP is largely implemented in-tree** (slices 1–22 + admin panels + composer stage), **default-off**, with **unit tests registered**, but the **live map still parks Social behind ads** and several **cross-pack callers / sibling packs / polish edges are unfinished**. Treat it as a **built-but-queued** advanced pack, not as “open for product enablement” or “done for production polish.”

---

## Queue conflict (read this first)

| Source | What it says |
| --- | --- |
| **Live map** (`architecture-current`) | Next product pack after the base-module pass is **`product:ads`**. Do **not** open Social, Chat, Shop, or Marketplace schema ahead of that. Social is listed under **Parked**. |
| **Preferences / platform layers** | Same: Social stays parked; commercial order is paid tickets → subscriptions → ads. |
| **`social-feed-plan.md` header** | Status: **parked**. Plan is the build spec; it does not change the queue. |
| **Code + pack README** | Slices **1–22** documented as shipped. `defaultEnabled: false`. ~151 files under `src/modules/social`, ~35k lines of TS/TSX including tests. Full `sf_social_*` schema present. |

**Implication for a second opinion:** The interesting question is not “should we start Social?” — the code already exists. The interesting questions are: (1) does the live map need an honest “built, still parked for enablement” line, (2) should further Social work stay frozen until ads, and (3) which ownership tensions to resolve before turning the module on for a site.

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
| Live video | Stays `product:stream` (not built here) |
| Money | `product:payments` is **required** so Social never grows a cart; **no Social charge path yet** |
| Mail | Email Manager triggers only (`emitEmailTrigger`); never `getMailer()` |
| Media / forms / maps / profiles / rich-editor | Consumed via owners; bytes stay in Media |
| Hero extras | `extensions` jsonb on posts/albums/etc. — not new `sf_social_*` columns |

**Hard `requires`:** profiles, media, rich-editor, forms, email-manager, payments, maps.  
**`optionalRequires`:** `product:subscriptions`, `product:events` — and a stray `'form'` string in the manifest (likely legacy / wrong id; worth a cleanup when Social is touched).

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

### 1. Live map vs disk

Social schema and product surface exist while the live map still says “do not open Social … schema ahead of ads.” Options usually debated:

- Leave map as-is (parked for *enablement / further work*; code is inventory).
- Update the live map to “Social MVP coded, still parked behind ads; do not enable for sites / do not extend until ads.”
- Treat accidental early build as debt and freeze hard until ads ships.

### 2. `product:comments` and `product:reports` vs Social’s own tables

[core-finish-instructions](./core-finish-instructions.md) still says:

- `product:comments` — thread on page/event/listing; **before Social**; page comments must not require Social.
- `product:reports` — shared report queue; **not** one report table per pack; same pass as comments or Social going public.

Social already has `sf_social_comments` and `sf_social_reports`. That is coherent for **feed posts**, but it conflicts with the “each pack does not get its own report table” line and with a future generic comments pack. Needs a boundary decision before Social is enabled:

- Social comments/reports stay **feed-scoped**; generic packs own page/event/listing threads and a shared report queue that Social can call into later, **or**
- Social’s tables become the temporary home and get peeled later (higher risk).

### 3. Cross-pack wiring incomplete

| Edge | Status |
| --- | --- |
| Events / Pages → `publishActivity` | Door ready; **no callers** |
| Events host calendar on group/page | Social lists/links via Events door; host fields exist on Events |
| Subscriptions entitlement `social.challenge.multi` | Gate exists; depends on Subscriptions being on |
| Core retention hide/purge | Doors registered on Core side |
| Media ACL for non-public attachments | Still open; `/api/media/[id]` is public for ordinary files — `canViewPost` does **not** hide bytes |
| Payments charge from Social | Required dependency only; no charge slice |
| Notifications / Search / Gamification / Chat | Slice 23 — packs absent or parked |

### 4. Product polish leftovers (not new slices, but unfinished UX)

- Composer: Challenge instrument and Watch chip not in the stage pass.
- `/feed/requests` is still a stub that redirects to People.
- Schema comment still says reaction `targetType` “comment later” in places while comment reactions are already implemented — doc drift.
- Manifest `optionalRequires` includes `'form'` (suspicious next to `product:forms` in `requires`).
- Hold-new-posts-for-review sets `staffHidden` on create; there is no separate “pending review” workflow beyond that flag + reports queue.
- Plan duplicate text on stories slice (cosmetic in the plan file).

### 5. Size vs commercial priority

Social is already one of the largest packs in the monorepo. Enabling it pulls Profiles, Media, Rich editor, Forms, Email Manager, Payments, and Maps. That is intentional (`requires`), but it means “turn Social on” is a **platform enable**, not a light feature flag. Second opinions often ask whether that dependency floor is still correct, especially **payments** and **maps** required before any charge or check-in is mandatory for every Social install.

### 6. What Social deliberately does not own

Per plan / README: points/badges, support tickets, chat, notification bell, live video, Profiles field schema, Email templates, Payments cart, Maps rooms, Hero airsoft columns. Keep those out.

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

## Suggested questions for a second opinion

Copy any subset:

1. Given the live map still parks Social behind ads, should we **freeze all Social code changes** until ads ships, or allow **docs/cleanup-only** (map honesty, `'form'` optionalRequires, comments/reports ownership note)?
2. Should `architecture-current` be updated to say **“Social MVP is in-tree, default-off, parked for enablement”** so agents stop treating Social as unstarted?
3. Confirm boundary: **feed comments/reports stay in Social**; `product:comments` / `product:reports` remain for page/event/listing — or reverse that decision now.
4. Is requiring **Payments + Maps** on every Social install still correct before Social has charges?
5. Priority of unfinished edges if Social is ever unparked: Media ACL for private attachments, Events/Pages `publishActivity` callers, composer Challenge/Watch chips, Notifications — what order?
6. Any slice-22+ surface that looks overbuilt for ASN Hero needs (short-video Watch, Discover, Challenges) and should stay switch-off forever for ASN?

---

## File map for reviewers

| Path | Role |
| --- | --- |
| [architecture-current.md](./architecture-current.md) | Live queue (wins) |
| [social-feed-plan.md](./social-feed-plan.md) | Slice build plan (parked header) |
| [platform-module-layers.md](./platform-module-layers.md) | Advanced placement |
| [core-finish-instructions.md](./core-finish-instructions.md) | `product:comments` / `product:reports` rows |
| [src/modules/social/README.md](../../../src/modules/social/README.md) | Owns / Consumes / Shipped |
| [src/modules/social/manifest.ts](../../../src/modules/social/manifest.ts) | Routes, nav, doors, requires |
| [src/modules/social/schema.ts](../../../src/modules/social/schema.ts) | All `sf_social_*` tables |
| [src/modules/social/api.ts](../../../src/modules/social/api.ts) / [api.server.ts](../../../src/modules/social/api.server.ts) | Public doors |

---

## Explicit non-goals of this brief

- Does not ask another agent to implement anything.
- Does not change the live map or queue.
- Does not declare Social “production ready.”
- Does not start Ads, Chat, Stream, or Notifications.
