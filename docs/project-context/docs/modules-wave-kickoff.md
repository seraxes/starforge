---
cursor:
  subagentId: "bc-37f1bbbe-5949-58d2-9173-dc4aca125a16"
---

# Modules wave kickoff (post–Email Manager)

**This kickoff already ran.** Events, Profiles, Maps, and Payments exist. Do not use it to pick the next pack. The active job is to finish Core: [architecture-current](./architecture-current.md).

**Purpose:** Lock the ASN surface → Starforge Module map, the post-Email build order, and the **first Module to build** with opening PRs.  
**Stance (historical, 5 Nov):** this kickoff treated the Core spine as done enough to start Events. That bar is withdrawn. Finish Core first. Email Manager had largely shipped (SF-204–207). Do not start Hero/ASN theme from this file.  
**Sources:** Live ASN inventory in [asn-modules-wireframe](./asn-modules-wireframe.md); [email-manager-plan](./email-manager-plan.md); [events-manager-plan](./events-manager-plan.md); [maps-location-plan](./maps-location-plan.md); [platform-module-layers](./platform-module-layers.md); [preferences](../preferences.md).

**Decision (this kickoff):** First substantive Modules-wave pack = **`product:events` (Events + venues)**. Thin **Profiles** stays optional glue — do **not** block Events on a full Profiles pack.

---

## 1. ASN surface → Starforge Module map

Non-Core live ASN features/extensions only. Core Auth / Layout / Chrome / Payload pages stay out of this queue.

| Live ASN surface | Starforge Module | Status now | Hero only (later) |
| --- | --- | --- | --- |
| Profile (bio, avatar, cover, privacy; team/phone…) | **Profiles** | none | Airsoft team / milsim fields via `extensions` |
| Friends / Bajtársak | **Social** | none | Noun branding |
| Feed + reactions + polls | **Social** (+ Media; Forms voting preset) | none | Feed skin |
| Albums / media facets | **Media** + Social binders | Media **shipped** | — |
| Groups / Pages (org walls) | **Social** (org entities) | none | Egyesület templates / workflows |
| Chat DM + multi-party | **Chat** | none | — |
| In-app bell (like/comment) | **Notifications** | none | — |
| Automatic / conditional email | **Email Manager** | **largely shipped** | — |
| Events list / calendar / timeline | **Events** | **dashboard stub only** | Field / milsim copy |
| Ticket tiers / factions / capacity | **Events** | none | Faction sheet nouns |
| Event registration + manage signup | **Events** + Forms `event-registration` | preset **shipped** | — |
| Organizer tools / registrant PII | **Events** admin + ACL groups | none | Legal attestations / TEÁOR |
| Event map / venue pins | **Maps** + Events venue binder | none | Field-finder filters |
| iCal subscribe | **Events** (export) | none | — |
| Marketplace / piactér (C2C) | **Marketplace** | dashboard stub only | Category fees / gear QA |
| Paid banner placements | **Ads** | none | Campaign policy |
| Global search deepen | **Search** | light `/search` shipped | — |
| Cookie / privacy banner | **Consent** | **shipped** | Copy skin |
| Live stream | **Stream** | none (park) | — |
| Gear photo QA AI | Hero apps → `MediaAnalysisPort` | port paper only | Entire surface |
| HU/EN + GTranslate | platform i18n later | none | — |

**Layer test:** If you can describe it without saying “airsoft,” it is a Module. Theme + vertical nouns = Hero after Modules.

---

## 2. Dependency snapshot (what is already green)

```text
Core host + ports (Auth, ACL groups, Layout/Nav, Mailer, RateLimiter,
  MediaStorage, M1/M2 module boundary) …………… DONE

product:forms (+ event-registration / survey / voting presets) …… DONE
product:media (library + picker) ……………………………………… DONE
product:consent / redirects / search (light) …………………… DONE
product:email-manager (rules, templates, triggers, Mailer) …… DONE
  └─ emitEmailTrigger + Forms notify path on rules

product:events ………………………………………………………… STUB (dashboard card only)
product:marketplace ………………………………………………… STUB (dashboard card only)
product:profiles / social / maps / chat / ads / notifications … NONE
```

**Read rule:** Next pack must consume Email Manager triggers (not invent SMTP). Events registration must reuse Forms — no second field builder. All images via Media `mediaId`.

---

## 3. Build order (Modules wave, post–Email)

One Module (or thin port-with-consumer) at a time. Diff ≈ `src/modules/<id>/**` + generated + migrations. Merge before starting the next slice when Zoltan opts in (prefs).

| # | Pack | Why here | Must take ahead | Skip / defer |
| --- | --- | --- | --- | --- |
| **✓ 0** | **Email Manager** | Shared rules/templates before any heavy emitter | — | **Shipped** |
| **1** | **Events + venues** ← **FIRST BUILD** | ASN’s primary product surface; deps already met | Data-home (venues/events); Forms preset hook; Email confirm trigger | Ticket tiers, AI draft, Maps |
| **1b** | **Profiles** (thin) | Optional glue for organizer/public byline; **required before Social** | Media avatar/cover; privacy ACL | Full Social fields; Hero extensions |
| **2** | **Maps** (venue pins + event map particle) | Live ASN event map; binds Events `locationId` | **`MapProvider`** Core port (leaflet-osm first) | Friends location sharing (needs Social) |
| **3** | **Events** densify (ticket tiers + organizer registrant admin) | Live ASN faction tickets / organizer PII tools | ACL organizer group; Email Manager | Payments; LLM unless “Draft description” opted in |
| **4** | **Profiles** complete (if 1b was minimal) → **Social** | Friends/feed/groups = EasySocial replacement | Notifications API sketch; Media; Forms voting | Chat, Stream |
| **5** | **Notifications** (in-app bell) | ÁSZF 3.9; Social/Events emitters | — | Replacing Email Manager |
| **6** | **Chat** | DM for marketplace deals + social | Profiles; Media attachments; Notifications | RTC/calls |
| **7** | **Marketplace** | Piactér C2C | Media; Profiles; Search provider; Chat-deal v1 OK | In-platform Payments until decided |
| **8** | **Ads** | Paid placements ≠ classifieds | Media; Layout banner particle | Tracking without Consent |
| **9** | **Search** deepen | Per-module providers | Module sitemap/search contribs | Algolia/Meilisearch early |
| **10** | **Stream** | Optional; not primary live ASN | Media video/ffmpeg if needed | ASN 2.0 MVP unless demanded |
| **H** | **Hero ASN** | Theme + domain on top of Modules | Public theme port; `extensions` seam | Any Module fork |

### Explicitly not next

- Social / Chat / Marketplace / Stream / Ads before Events proves the data Module contract.  
- Maps before Events venues exist (nothing to pin).  
- Full Profiles megapack before Events (wireframe: *thin / optional*).  
- Hero dark theme / airsoft nouns before public theme port + Events/Profiles `extensions`.  
- Stub `MapProvider` / `Payments` / `LlmProvider` / `MediaAnalysisPort` with no consumer.  
- WordPress migration (after Core + Modules + Hero).

---

## 4. Recommended first module

### Pick: **`product:events` (Events + venues)**

**Why (ordered):**

1. **ASN product gravity** — Live airsoftnexus.com is event-led (timeline, calendar, event map, registration, organizer tools). Highest non-Core surface value after Email Manager.  
2. **Dependencies are green** — Forms `event-registration` preset, Media picker, Email Manager `emitEmailTrigger`, ACL groups, M1/M2 host, module info/settings host (SF-230). No new Core port required for v1 CRUD + list.  
3. **Stub already allowlisted** — `product:events` exists as dashboard-only soft card; densifying it is the natural first real pack, not a greenfield id.  
4. **Unlocks Maps** — Venue entities are the binder for `product:maps` pins; building Maps first would be empty chrome.  
5. **Proves the heavy-Module contract** — Schema + admin + particles + Form hook + Email trigger is the template Social/Marketplace will copy. Better to learn that on Events than on Chat.  
6. **Profiles can wait** — Organizer display can use Auth user (+ optional Media avatar) until a thin Profiles slice; Social is what *requires* Profiles, and Social is later.

**Not Profiles-first:** Wireframe listed Profiles as *thin / optional ahead* — useful glue, not the ASN proof pack. Building full Profiles now delays calendar/registration value without unblocking Maps.

**Not Marketplace/Social/Chat-first:** Heavier graphs, media feeds, or deal flows; need Profiles (and often Chat/Notifications). Wrong risk for the first post-Email Module.

### First 2–3 PRs (Events v1)

Ship **one PR at a time**; merge before the next when autonomous merge is on.

| PR | Title (working) | Scope | Out of scope |
| --- | --- | --- | --- |
| **PR1** | Events schema + admin CRUD | `sf_venues` / `sf_events` (or Payload-backed module tables); admin list/edit; ACL group tags; Media cover/`mediaId`; module settings + info page; replace dashboard stub loader with real upcoming counts when data exists | Registration, public particles, Maps, tickets, AI |
| **PR2** | Events public particles + Nav views | Particles: `event-list` + `event-detail` (calendar particle OK if thin); Nav bind to module routes; Page Settings–style admin chrome; wire `events.upcoming` dashboard card to live query | Maps particle; ticket tiers |
| **PR3** | Registration + Email confirm | Bind Forms **event-registration** preset; `onSubmitted` capacity / attendee row; Email Manager trigger e.g. `events.registered` (template + rule); registrant “manage my signup” minimal | Faction ticket matrix; organizer PII export polish; Payments; `LlmProvider` |

**After PR3 (next wave, not this first pick):** Maps `MapProvider` + venue pins → Events ticket tiers / organizer admin → thin Profiles → Social…

### Optional micro-slice (only if PR2 bylines feel empty)

- **Profiles 0.5:** `displayName` + `avatarMediaId` + privacy enum on `sf_profiles` — one small PR **between** Events PR1 and PR2, or immediately after PR3. Do **not** expand into Social.

---

## 5. Open product questions (carry from wireframe)

Still need Zoltan when the matching pack starts — not blockers for Events PR1:

1. **Marketplace v1:** C2C chat-deal (live ASN) vs in-platform Payments day one?  
2. **Groups/Pages:** inside Social, or separate `product:organizations`?  
3. **Ticket tiers:** first-class Events model vs Form multi-choice + capacity only?  
4. **Ads:** real ASN 2.0 need, or defer until after Marketplace?  
5. **Maps v1:** venue/event pins only, or also user location sharing?  
6. **Hero `extensions` jsonb:** lock shape when Events lands?  
7. **Stream:** drop from ASN 2.0 MVP?

---

## 6. Verify

- [x] Read [asn-modules-wireframe](./asn-modules-wireframe.md), [email-manager-plan](./email-manager-plan.md), [preferences](../preferences.md), [events-manager-plan](./events-manager-plan.md), [core-remaining](./core-remaining.md)  
- [x] Confirmed Email Manager in tree (`src/modules/email-manager/**`, allowlist `product:email-manager`) and Events stub-only (`src/modules/events/README.md`)  
- [x] This file at `docs/modules-wave-kickoff.md`  
- [x] First pick + first 2–3 PRs explicit in §4  

---

## Related

- [asn-modules-wireframe](./asn-modules-wireframe.md)  
- [email-manager-plan](./email-manager-plan.md)  
- [events-manager-plan](./events-manager-plan.md)  
- [maps-location-plan](./maps-location-plan.md)  
- [platform-module-layers](./platform-module-layers.md)  
- [design-module-boundary](./design-module-boundary.md)  
- [core-remaining](./core-remaining.md)  
- [admin-dashboard-plan](./admin-dashboard-plan.md)  
