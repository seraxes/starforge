---
cursor:
  subagentId: "bc-5056f8e8-cd66-51ec-871f-8d79af06b092"
---

# Starforge Core — gaps evaluation

**Lens:** Opus design docs ([architecture-opus-audit](./architecture-opus-audit.md), [design-system-overview](./design-system-overview.md), [design-security](./design-security.md), [design-data-deploy](./design-data-deploy.md), [design-module-boundary](./design-module-boundary.md)) + [preferences](../preferences.md) + [notes](../notes.md) vs `seraxes/starforge` `main` @ `2711964` (spot-check Nov 4, 2026).

**Verdict:** Core spine that the design docs called “now” is largely **shipped** (auth, layout host, Forms+upload hardening, Media Manager Phases 1–2, Redis cache, S3, CSP/csrf, Consent, redirects/sitemap, search/taxonomy, migrations+CI, env boot validation, manifest **M0**). What still blocks a clean next Module wave is **not** missing product packs — it is unfinished **security ports**, **authz fail-closed**, and **module boundary M1–M2** (new packs still edit Core admin nav / particle actions). Hero/ASN correctly stays later. Inventory doc is stale; trust design overview + this eval over [core-modules-inventory](./core-modules-inventory.md).

---

## Done (Core so far)

| Area | Evidence |
| --- | --- |
| **Auth platform** | Better Auth sole login; CMS bridge; forgot/magic/OTP/2FA; Secure cookies |
| **Layout / Nav / Chrome host** | Gantry outlines, Page Settings, Nav manager, Site Chrome, particles |
| **Mailer port** | console / SMTP / Resend; Forms + auth mail |
| **Forms engine** | Builder, conditional/math, upload+hidden, captcha field, CSV, submissions `jsonb` + `definition_version` + `user_id` (#75/#82/#88) |
| **Form upload security** | Captcha→upload order; no anon SVG; `folder=forms` + `private`; `bodySizeLimit` 12mb; admin attachment route |
| **Media library** | Payload store; sharp/WebP; picker; S3/Spaces throw-if-incomplete; tags; nested Categories; lightbox; mosaic/list; Media→Settings (Phases 0–2) |
| **Redis content cache** | Adapter shipped; `STARFORGE_REDIS_PREFIX`; null-miss TTL |
| **Security headers / CSP / csrf** | Headers + composed CSP feature sources; Payload `csrf: payloadCsrfOrigins()` (#78/#84) |
| **Consent / Redirects / Search** | Toggleable packs; public `/search`; Tags + Categories |
| **Migrations + CI** | Drizzle + Payload baselines; CI check/unit/migrate/smoke/flavor (#85) |
| **Env boot validation** | `instrumentation` → `core/env/validate` |
| **Module Manager M0** | `defineStarforgeModule`, allowlist codegen, one catalog, Core↛`@/modules` |
| **Admin theme (1 theme)** | Gantry dark chrome; admin CSS split from public; Payload chrome polish in flight (SF-179/180) |
| **Deploy local hygiene** | Compose Postgres/Redis bound `127.0.0.1` |

---

## Gaps blocking next Modules

Prioritized — finish before Events / Maps / Chat / Shop (focus guard).

| P | Gap | Why it blocks | Design ref |
| --- | --- | --- | --- |
| **P0** | **Module boundary M1–M2 incomplete** — admin nav still hardcoded; per-particle actions/editors still in Core; Forms/Media logic still `src/core/{forms,media}`; Consent/Redirects not fully “manifest-only” (sitemap still Core) | Every new pack still touches Core (~20–30 files). Acceptance test in design-module-boundary fails. | boundary M1–M2; overview §4–5 |
| **P0** | **`RateLimiter` port missing** — Form still uses in-memory `forms/rate-limit.ts`; no Redis adapter; not shared with auth | Multi-instance / DO hosting wrong; auth recovery can be abused without shared limiter | security §6 |
| **P0** | **`clientIp` still trusts first XFF hop** — ignores `STARFORGE_TRUSTED_PROXY_HOPS` / prefer nginx `x-real-ip` first | Rate limits spoofable; catalog already documents the env key | security §6 |
| **P0** | **Developer-admin fail-open** — empty `STARFORGE_DEVELOPER_ADMIN_EMAILS` ⇒ every app admin is developer-admin (incl. prod) | Script fields / Environment / analytics atom unlocked in production | security §5; audit #3 |
| **P0** | **Payload `site-settings` `update: Boolean(user)`** — any CMS user can flip modules/registration outside Core admin | Bypasses Core Settings ACL; dual write surface | security §5; audit #3 |
| **P1** | **Captcha still in `core/forms`** — not a Core security port; unwired reCAPTCHA/hCaptcha risk; no auth-surface captcha toggles | Auth email-bomb / reuse across modules blocked | security §7 |
| **P1** | **Better Auth `trustedOrigins` hardcoded localhost**; no Redis `secondaryStorage` / rateLimit | Prod origin drift; multi-node auth memory | security §4; data-deploy §4 |
| **P1** | **Redis `invalidateTags` fire-and-forget**; layout/nav/page-chrome/offline/CSP still uncached; middleware still internal HTTP hops (no `proxy.ts` policy doc) | Stale reads + request cost before scale / SF-6 | data-deploy §4–5; security §4 |
| **P1** | **ACL matrix UI is stub** — `viewerMayAccessAdminResource` has no callers; gates = role-only | Groups-based admin rights (preference) not real; Managers cannot be modeled | security §5 / §9 |
| **P2** | **Form presets beyond contact mostly stubs** (survey / event-registration / voting) | Events registration needs a real preset + `onSubmitted` on Forms API after M4 | form plans; boundary §6 |
| **P2** | **Media still Core-hosted** (M5 not done); Phase 3 hygiene (bulk, analysis button) thin | Heavy modules must bind picker only — OK today, but Media not a true toggleable pack | media-manager-spec §6; boundary M5 |

**Recommended next sequence (matches preferences design SoT):**  
1) Security P0 slice (RateLimiter + clientIp + developer fail-closed + site-settings Core-admin gate + captcha→`core/security`) → 2) Manifest M1–M2 (generic slot action/editor + nav/routes/settings host) → 3) Redis auth/cache await + proxy policy → 4) then first heavy Module on the contract.

---

## Nice-to-have

- Media Manager **Phase 3** (bulk select/move/tag, richer search, Analyze button, derivative sync UI)
- Dynamic admin theme CSS import (env registry works; layouts still static-import gantry)
- Mailer shared transactional templates; Particle Defaults panel depth
- Form dual-schema cleanup (JSON Schema read-only / drop legacy inline fields path)
- Consent category UI; redirect CSV import; cache redirect lookup at volume
- Tailwind + shadcn polish (explicitly deferred in preferences)
- Module Packages P2 (`@starforge/module-*` / `modules:sync`)
- Doc hygiene: refresh [core-modules-inventory](./core-modules-inventory.md) (Redis/CSP/search/consent/migrations rows drift)
- Finish open admin chrome polish (SF-179/180) before calling Payload “seamless”

---

## Explicitly later (Hero / ASN)

Do **not** start until public theme port + manifest extension seam exist (build order + focus guard).

| Item | Notes |
| --- | --- |
| **SF-8 ASN Hero** | Dark tactical theme + team/RP/fees/airsoft rules — skins Modules, never forks |
| **SF-33 public dark pastel toggle** | Public theme port (`{ tokens, css }` registry) first; not admin chrome |
| **Events / Maps / Chat / Social / Stream / Shop / Marketplace / Ads** | Modules on real ports; Events needs Form preset API + Media picker only |
| **`LlmProvider` / `MapProvider` / real `MediaAnalysisPort` vendors** | Paper until a consumer Module ships — no stub ports |
| **Queues (BullMQ), webhooks, i18n, in-app notifications** | On demand after Redis rate-limit path is real |
| **Video / ffmpeg**; rich Media ACL group tags; HEIC | media-pipeline “explicitly later” |
| **SF-6 live DO hosting** | After local-first + deploy-ready checklist (migrations/CI mostly done; security P0 + Redis auth still open) |

---

## Priority cheat-sheet

1. **Security P0** (limiter, IP, developer fail-closed, Payload site-settings gate, captcha port)  
2. **Manifest M1–M2** (stop editing Core for every pack)  
3. **Multi-node Redis** (await invalidate, BA secondaryStorage, cache chrome/proxy)  
4. **ACL enforce or keep clearly stub**  
5. **Public theme port** → then Hero/ASN  
6. Heavy Modules only on the contract  

Open queue context: SF-171 Media Manager spec (for review — Phases 1–2 already on main); SF-179/180 Payload chrome in progress; SF-33 / SF-8 / SF-6 correctly queued later.
