---
cursor:
  subagentId: "bc-08115c42-6220-5047-8dda-3f2850e7ed4f"
---

# ASN → Starforge Modules wireframe (preliminary)

**Queue superseded (2026-11-10).** Use this file for the ASN surface → layer inventory. Do **not** use §3 as the build order. Payments is not optional, and Ads does not wait behind Social and Chat. Live queue: [architecture-current](./architecture-current.md). i18n P0–P3 has shipped; the “i18n later” row is historical.

**Purpose:** Map live [airsoftnexus.com](https://airsoftnexus.com) product surfaces onto Starforge **Modules** vs **Hero**, with dependency graph and build order.  
**Stance:** Core spine is **done** (security, Forms presets, Media M5+Phase3, module boundary M1/M2, CI [#120](https://github.com/seraxes/starforge/pull/120)). **Do not rebuild Core.** This is the Modules-phase plan; ASN 2.0 Hero comes after Modules + public theme port.  
**Sources:** Live ASN (timeline, calendar, event map, marketplace URLs, EasySocial/Event Booking surfaces) + ASN ÁSZF §3; [platform-module-layers](./platform-module-layers.md), [email-manager-plan](./email-manager-plan.md), [events-manager-plan](./events-manager-plan.md), [maps-location-plan](./maps-location-plan.md), [media-manager-spec](./media-manager-spec.md), [design-module-boundary](./design-module-boundary.md). Cloudflare blocked some raw fetches; inventory triangulated via indexed pages + ÁSZF.

**Decision (2026-11-05):** Build full **Email Manager** (shared automatic/conditional emails, one admin manager, filter/categorize by module) **before** heavy Modules (Events / Maps / Social / Marketplace…). Thin Profiles may still ship first as optional glue; Email Manager is clearly ahead of Events+.

**Layer reminder**

| Layer | Role |
| --- | --- |
| **Core** | Host + ports (Auth, ACL, Layout, Mailer, cache, MediaStorage, …) — **shipped / leave alone** |
| **Modules** | Toggleable reusable packs any Starforge site can enable |
| **Hero (ASN)** | Dark tactical theme + airsoft domain rules/workflows on top of Modules — **never forks** |

---

## 1. ASN surface inventory → Module vs Hero

| Live ASN surface (evidence) | Starforge home | Notes |
| --- | --- | --- |
| Login / register / forgot user+pass (`/belepes`, EasySocial gate) | **Core Auth** (done) | Better Auth + Mailer; no ASN fork |
| User profile (name, username, bio, avatar, cover, privacy; optional team, phone, …) — ÁSZF 3.1 | **Module: Profiles** | Generic profile/privacy; team name & airsoft fields = **Hero extensions** |
| Friends / “Bajtársak” — ÁSZF 3.8 | **Module: Social** | Friend/follow graph; Hero only brands noun |
| Feed posts (text, media, links, polls) + reactions (like types) — ÁSZF 3.4–3.5 | **Module: Social** (+ **Media**, optional **Forms** voting preset) | One Social pack; FB-like vs short-video = layout options |
| Albums / Photos / Videos / Audio search facets | **Module: Media** + **Social** | One Payload library; Social binds `mediaId` |
| Groups + Pages (org walls, ACL) — ÁSZF 3.13; nav: Csoportok / Oldalak | **Module: Social** (org entities) | Sport *egyesület* workflows / ASN page templates = **Hero** |
| Chat DM + multi-party (text, images, files) — ÁSZF 3.7 | **Module: Chat** | RTC/calls = later Core port when needed |
| In-app notifications (like/comment/share) — ÁSZF 3.9 | **Module: Notifications** | Transactional / automatic email = **Email Manager** on Mailer port (not per-module SMTP) |
| Automatic / conditional emails (form notify, auth, event confirm, digests…) | **Module: Email Manager** | One admin; rules + templates; module-scoped filter; triggers from modules; **reuses Core Mailer** |
| Events list / timeline (`/en/timeline`, `/esemeny-naptar`) | **Module: Events** | Capacity, price display, status |
| Ticket types / factions / capacity slots on events | **Module: Events** (ticket tiers) | Airsoft faction/milsim sheet copy = **Hero** fields on same entities |
| Event registration + manage own signup — ÁSZF 3.10 | **Module: Events** + **Forms** `event-registration` preset | No second field builder |
| Organizer tools (create event, manage registrants, see PII) — ÁSZF 3.11–3.12 | **Module: Events** admin + **ACL groups** | Organizer *legal* attestations / TEÁOR / field-safety = **Hero** policy UX |
| Event map (`/esemeny-terkep`) + venue pins | **Module: Maps** + Events venue binder | Field-finder filters / branded map chrome = **Hero** |
| iCal subscribe on timeline | **Module: Events** (export) | Thin calendar feed |
| Marketplace / piactér / apróhirdetés (`/marketplace/…`) — ÁSZF 3.4 (C2C, private deal) | **Module: Marketplace** | Catalog fees, airsoft category rules, QA of gear photos = **Hero** (+ optional `MediaAnalysisPort` apps) |
| Paid banner / placement ads (platform catalog) | **Module: Ads** | Distinct from classifieds; ASN campaign policy = Hero |
| Global search (Events, Groups, Marketplace, People, Pages, Photos, Videos, …) | **Module: Search** (+ Posts/taxonomy as needed) | Core `/search` exists; deepen providers per module |
| HU / EN UI + GTranslate widget | **Later: i18n** (platform) | Not a product Module; defer until Hero localization push |
| Cookie / privacy banner | **Module: Consent** (done) | Keep; Hero only skins copy |
| CMS brochure pages (egyesület stories, static) | **Core Payload pages** + Layout | Hero theme skins; no Events fork |
| Live stream / watch parties | **Module: Stream** (later) | Not a primary live ASN surface today — park after Chat/Marketplace |
| Quality-check AI (gear photo OCR/vision) | **Hero apps** → Core `MediaAnalysisPort` | Do not fork Media |

---

## 2. Dependency graph (Modules phase)

```text
Core (done) ── Auth · ACL groups · Layout/Nav · Mailer · RateLimiter
            · MediaStorage · Module host (M1/M2)
     │
     ├── product:media (required) ──────────────┐
     ├── product:forms (+ presets) ─────────────┤
     ├── product:consent / redirects / search   │  (light packs; mostly shipped)
     │                                          ▼
     ├── product:email-manager  ◄── Mailer port (no per-module SMTP)
     │         │   rules · conditions · templates · module filter
     │         │   consumed by Forms / Auth / Events / Social / …
     │         ▼
     ├── product:profiles (thin, optional ahead) ──► Social ──► Notifications
     │                              │              │
     │                              └──────────────┼──► Chat
     │                                             │
     ├── product:events ◄── Forms event-registration
     │         │            Media picker · Email Manager confirms
     │         ▼
     ├── product:maps ◄── MapProvider (Core port) + Events venue pins
     │
     ├── product:marketplace ◄── Media · Profiles · (optional Payments port)
     ├── product:ads ◄── Media · Layout particles
     └── product:stream (later) ◄── Media · ACL

Hero: ASN theme + extensions jsonb on Profiles/Events/Marketplace/Social
      requires: public theme port + module `extends` seam
```

**Read rule:** arrows = “needs before / consumes.” Hero sits on the right edge — skins and vertical fields only. **Email Manager before Events/Maps/Social** so later packs emit triggers instead of owning SMTP/templates.

---

## 3. Recommended build order + “must take ahead”

**Historical (5 Nov).** The active job is to finish Core. After that, the commercial order is paid tickets → subscriptions → ads. See [architecture-current](./architecture-current.md). The table is kept so the dependency notes stay readable. “Payments only if checkout” on the Marketplace row is withdrawn: marketplace fees use `product:payments` when that pack is built, and it is not next.

Core is not in this queue. A pack may add a Core port. Product behavior stays in `src/modules`. The old “diff touches only `src/modules`” line is withdrawn.

| # | Build | Must take ahead (ports / contracts) | Reuses already |
| --- | --- | --- | --- |
| **0** | Keep Core frozen; only thin ports when a consumer lands | — | M1/M2 host, ACL, RateLimiter, Forms presets, Media M5, **Mailer** |
| **0.5** | **Email Manager** (shared automatic/conditional emails; one admin; filter by module) | Rule/trigger contract modules will call; template storage; **no** second SMTP stack | Core **Mailer** port + Chrome email policy; Forms notify migrate onto rules |
| **1** | **Profiles** (generic avatar/cover/bio/privacy) — *shipped v1* (`product:profiles`, `getPersonas`) | Hero `extensions` jsonb seam ready; ASN team/logo fields = Hero later | Media picker + member upload ledger; Auth user; per-field privacy |
| **2** | **Events + venues** (CRUD, list/calendar particles, capacity) | Data-home: venues/events editorial vs `sf_events_*` registrations; `registerFormPreset` + `onSubmitted` capacity hook | Forms **event-registration**; Media cover/gallery; **Email Manager** confirms; ACL organizer group |
| **3** | **Maps** (venue pins + event map particle first) | **`MapProvider`** Core port (leaflet-osm first); open Permissions-Policy `geolocation` when shares ship | Events `locationId`; Consent for share opt-in |
| **4** | **Events** ticket tiers + organizer registrant admin | Optional **`LlmProvider`** only if “Draft description” ships in same wave | Forms; ACL; Media; Email Manager |
| **5** | **Social** (friends, feed, groups/pages, reactions) | Notifications API sketch; privacy scopes aligned with Maps (`friends`) | Profiles; Media; optional Forms **voting** preset for polls; Email Manager for digests |
| **6** | **Notifications** (in-app bell) | — | Social/Events/Chat emitters; Email Manager digests optional |
| **7** | **Chat** (DM + groups) | Redis already; later **RTC port** only if calls | Profiles; Media attachments; Notifications |
| **8** | **Marketplace** (C2C listings) | **`Payments` port** only if checkout/fees in-platform; else chat-deal v1 like live ASN | Media; Profiles; Search provider; optional Ads cross-link |
| **9** | **Ads** (placements + campaign CRUD) | Layout particle slot for banners | Media; ACL; Consent if tracking |
| **10** | **Search** providers deepen | Per-module sitemap/search contributions | Existing `/search` + taxonomy |
| **11** | **Stream** (optional) | Media video/ffmpeg path if needed | Media; ACL |
| **H** | **Hero ASN** (theme + domain) | **Public theme port** `{tokens,css}`; Events/Profiles/Marketplace `extensions`; Joomla hash migrate lives in Hero app | All Modules above — no forks |

### Explicitly *not* first

- **Events / Maps / Social / Marketplace / Chat / Stream** before **Email Manager** (user decision 2026-11-05).  
- Chat / Stream / Shop megapacks before Events+Maps prove the module contract.  
- Hero dark theme before public theme port.  
- Stub `LlmProvider` / `MapProvider` / `Payments` / `MediaAnalysisPort` with no consumer.  
- Per-module SMTP / From stacks — transport stays Core Mailer + Chrome.

---

## 4. What already reuses Forms / Media / ACL

| Concern | Reuse — do not rebuild |
| --- | --- |
| Event signup fields, gear-rental questions, rule acknowledgements | **Forms** `event-registration` (+ conditional/math); Events only supplies `onSubmitted` (capacity, ticket tier) |
| Polls / voting in feed | **Forms** voting preset *or* thin Social reaction — still not a second builder |
| Contact / organizer applications | **Forms** contact/survey presets |
| Automatic / conditional / templated email (form notify, confirms, digests, auth) | **Email Manager** on Core **Mailer** — one admin, module-scoped filter; modules emit triggers, do not own SMTP |
| All images (avatars, covers, event galleries, listing photos, ad creatives) | **Media** shared library + `MediaPicker` / `mediaId` |
| Who can see nav, events, listings, groups | **Groups ACL** (OR tags; empty = public); organizer = group right via ACL matrix |
| Auth gates on registration | **Core Auth** session; Forms `user_id` on submissions |

---

## 5. Hero vs Module split (ASN 2.0)

**Modules (generic nouns):** Email Manager, Profiles, Social, Chat, Events, Maps, Marketplace, Ads, Notifications, Stream, Search…  

**Hero only:**

- ASN **dark tactical / gaming / military** public (+ admin skin if desired) via theme port  
- Airsoft **team / bajtárs / egyesület / milsim / field** vocabulary and extra fields (`extensions`)  
- Organizer **legal attestations** and fee tables  
- Marketplace **category taxonomy & commission policy**  
- Quality-check **AI apps** calling `MediaAnalysisPort`  
- Joomla 5 user-hash / data migration into the ASN app — not Core  

**Test:** If you can describe the feature without saying “airsoft,” it belongs in a Module.

---

## 6. Open product questions for Zoltan

1. ~~**Events first vs Profiles first?**~~ **Decided (2026-11-05):** **Email Manager** after Core freeze (Profiles thin optional) → **then** Events / Maps / Social…. See [email-manager-plan](./email-manager-plan.md).  
2. **Marketplace v1:** stay C2C “deal in chat” (live ASN / ÁSZF) or need in-platform **Payments** + fees day one?  
3. **Groups/Pages:** keep inside **Social**, or a separate `product:organizations` module?  
4. **Ticket tiers:** first-class Events model, or Form multi-choice + capacity hooks only? (Live ASN has rich faction tickets.)  
5. **Ads vs Marketplace:** are paid banners a real ASN 2.0 need, or defer Ads until after Marketplace?  
6. **Chat timing:** block Social→Chat early for marketplace deals, or Email Manager / Mailer until Chat ships?  
7. **Maps scope v1:** event/venue pins only, or also user location sharing (needs Social friends)?  
8. **i18n:** HU-first Hero strings acceptable until a real i18n pack, or block Hero on `next-intl`?  
9. **Stream:** drop from ASN 2.0 MVP?  
10. **Hero extension seam:** prefer `extensions jsonb` on module rows (design-module-boundary §6) — OK to lock when Events lands?  
11. **Email Manager v1 depth:** rules + conditions + templates + module filter only, or also send log / retries / HTML designer in the first slice?

---

## Related

- [platform-module-layers](./platform-module-layers.md)  
- [email-manager-plan](./email-manager-plan.md)  
- [email-mailer-plan](./email-mailer-plan.md) (shipped Mailer port)  
- [events-manager-plan](./events-manager-plan.md)  
- [maps-location-plan](./maps-location-plan.md)  
- [media-manager-spec](./media-manager-spec.md)  
- [design-module-boundary](./design-module-boundary.md)  
- [project-context](./project-context.md)  
- [core-gaps-evaluation](./core-gaps-evaluation.md) (Core spine; Modules next — not a rebuild list)
