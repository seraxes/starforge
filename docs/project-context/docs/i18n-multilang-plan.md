# Multilanguage (i18n) plan — before Modules wave

**Purpose:** Lock App Router best practice for Starforge locales **before** heavy Modules (Events…) so packs ship with a string/content contract instead of retrofitting later.  
**Stance:** Plan + phased PRs only — **no implementation in this task.** Prefer modular Core ([modular-core](../principles/modular-core.md), [platform-module-layers](./platform-module-layers.md)). ASN Hero / GTranslate replacement comes **after** Core + Modules ports.  
**Sources:** Next.js 16 App Router + Payload 3 in-repo; live ASN “HU/EN + GTranslate” note in [modules-wave-kickoff](./modules-wave-kickoff.md); Payload ↔ next-intl industry pairing.

---

## Recommendation (one stack)

| Layer | Choice | Why |
| --- | --- | --- |
| **Public UI strings + `[locale]` routing** | **`next-intl`** | First-class App Router / RSC; `defineRouting` + proxy/middleware; ICU messages; static rendering via `setRequestLocale` / `generateStaticParams`. Fits Next 16. |
| **CMS editorial content** | **Payload `localization`** | Field-level locales on Pages (and later Posts); same locale codes as `next-intl`; query bridge `payload.find({ locale })`. Already the content module. |
| **Admin UI language** | **Core preference (cookie/user), not URL prefix** | Keep `/admin` and `/cms` **outside** `[locale]`. Editors work in one admin language; content locale is Payload’s locale switcher. |
| **Module / Hero strings** | **Namespaced message files + manifest hook** | Core hosts catalogs; Modules/Hero contribute `messages/<locale>.json` — no hard-coded Core↔Module string coupling. |

**Do not adopt `next-i18next`** for new App Router work. **Do not** invent a full custom i18n stack (routing + ICU + RSC). **Do not** keep GTranslate as the long-term public solution (stopgap only until real locales ship).

---

## 1. Library comparison

| Option | Fit for Starforge | Pros | Cons | Verdict |
| --- | --- | --- | --- | --- |
| **`next-intl`** | Excellent | App Router–native; middleware/proxy locale negotiation; server + client hooks; typed messages; documented Payload pairing | Another dependency; public tree moves under `[locale]` | **Choose** |
| **`next-i18next` / i18next** | Poor for greenfield AR | Mature ICU/ecosystem; familiar to Pages Router shops | Pages-Router heritage; heavier wiring for RSC; not Next’s current AR guidance | **Skip** for public AR |
| **Custom (JSON + hand middleware)** | Tempting, costly | Full control; no library | Reinvent negotiation, alternates, ICU plurals, RSC caching; fights modular Modules later | **Skip** as primary; thin Core **port** may wrap `next-intl` |

**Port shape (Core):** treat i18n like Mailer/cache — a thin Core host (`src/core/i18n/`): locale config, message merge, `Link`/`redirect` helpers from `next-intl/routing`. Modules never import `next-intl` directly for config; they register message namespaces via the module boundary.

---

## 2. `[locale]` routing (App Router)

### Target public URL shape

- Prefix locales: `/en/...`, `/hu/...` (ASN needs HU/EN; Starforge default catalog starts **`en` + `hu`**).
- **Default locale:** platform default `en`; Hero/ASN may later set site default to `hu` via Site Chrome (config), not a second routing library.
- Prefer **`localePrefix: 'always'`** initially (every public URL has a prefix) — clearer cache keys, sitemap, and redirects. Optional `as-needed` later if SEO demands bare `/` for default.

### What goes under `[locale]`

| In `[locale]` | Outside `[locale]` (no prefix) |
| --- | --- |
| Public pages `(public)/page`, `[slug]`, `search`, `login`/`register`/account UX copy, consent particle, public module views | Core `/admin/**`, Payload `/cms/**`, auth API, media binary URLs, webhooks, `robots.txt` |

Today public lives under `src/app/(frontend)/(public)/…` with `[slug]` at the root of that group. Implementation moves that tree to `(frontend)/(public)/[locale]/…` (or a top-level `(frontend)/[locale]/(public)/…`). **Admin route group stays put** so admin bookmarks and SSO (`/cms/admin`) do not gain `/en/admin`.

### Proxy composition

Starforge already centralizes edge logic in `src/proxy.ts` (redirects, Payload SSO gate, security). Locale middleware from `next-intl` must **compose** with that chain (locale negotiation early; existing handlers keep order). Matcher excludes `/admin`, `/cms`, `/api`, static assets.

### SEO / cache

- `generateStaticParams` for locales (+ slug×locale for Pages).
- `alternates.languages` / hreflang from the same locale list.
- Published-content cache tags must include **locale** (invalidate per slug+locale, not slug-only).
- Sitemap: one entry set per locale (or xhtml links); extend existing `listPublishedPagesForSitemap`.

### Nav / redirects

- Nav item hrefs become locale-aware (helper from Core i18n port).
- Redirects module: store paths **without** forcing a locale, or store per-locale targets explicitly — decide in the redirects PR (prefer path-relative + current request locale).

---

## 3. Payload content locales

Enable in `payload.config.ts`:

```ts
localization: {
  locales: [
    { code: 'en', label: 'English' },
    { code: 'hu', label: 'Magyar' },
  ],
  defaultLocale: 'en',
  fallback: true,
}
```

**Localized fields (v1):** Pages `title`, Lexical `content`, SEO meta title/description. **Slug:** keep **one slug shared across locales** for v1 (simpler Nav + redirects); localized slugs are a later opt-in if ASN marketing needs `/hu/esemenyek` vs `/en/events`.

**Bridge (the only required join):** public loaders pass the route locale into Payload:

`payload.find({ collection: 'pages', locale, fallbackLocale: defaultLocale, … })`

Same for search, preview, sitemap. Core content helpers (`src/core/content/*`) gain a required `locale` argument — no silent default in public paths.

**Media / Tags / Categories:** filenames and binary assets stay shared; optional localized **alt/caption/label** later. Do not duplicate media libraries per locale.

**Admin editing:** Payload’s built-in locale selector in `/cms` is the source of truth for content language. Core does not reimplement a second CMS locale UI.

---

## 4. Admin language (UI chrome)

| Concern | Policy |
| --- | --- |
| **URL** | No `/hu/admin` — admin stays `/admin`, `/cms` |
| **Default** | English catalogs for Core admin chrome (Gantry-style UI) |
| **Preference** | Optional later: per-user or cookie `adminLocale` loading `messages/admin/<locale>.json` |
| **Payload UI** | Leave Payload’s own admin i18n defaults; do not block Core on translating Payload chrome |
| **Content vs UI** | Admin language ≠ page locale. Editor may use EN admin UI while editing HU Payload fields |

v1 can ship **admin English-only** while public is bilingual — reduces scope before Modules.

---

## 5. Core vs Module strings

Three string sources — keep them separate:

| Source | Owner | Storage | Examples |
| --- | --- | --- | --- |
| **A. UI chrome** | Core + Modules (code) | `messages/<locale>/<namespace>.json` merged at request | “Save”, “Sign in”, Form validation, Consent copy defaults |
| **B. Editorial CMS** | Editors (Payload) | Localized fields | Page body, marketing titles |
| **C. User/config copy** | Site admins | DB documents (Nav labels, particle text, Form field labels, Email templates) | May stay single-locale until a later “localize this field” pass |

### Modular message contract

Align with [design-module-boundary](./design-module-boundary.md):

- Core merges namespaces: `core.*`, plus each enabled module’s `product:<id>.*`.
- Module manifest gains optional `i18n?: { namespaces: string[]; load: (locale) => Promise<Messages> }` (or convention `src/modules/<id>/messages/<locale>.json` discovered by `modules:generate`).
- Disabled modules → their namespaces omitted (no deadweight strings).
- Modules must not hardcode user-visible English in public/admin React; use `t('product:events.…')`.
- **Form engine / Email templates:** structured copy in DB remains author-edited; ship **default seed strings** per locale in module message packs where useful.

### Site Settings

- Site Chrome (or Settings → Localization topic): enabled locales, default locale, fallback on/off.
- Toggleable: multilang off → single default locale, no prefix behavior (or prefix hidden) — keep modular.

---

## 6. ASN Hero later

| Now (Core) | Later (Hero ASN) |
| --- | --- |
| Locale port + `en`/`hu` catalogs for platform strings | ASN theme (dark tactical) — unrelated to i18n library |
| Payload Pages localization | Hero-only copy / milsim nouns in `hero:asn` message namespace |
| Replace GTranslate dependency conceptually | Site default locale `hu`; optional domain strategy (`hu.` / `en.`) if needed |
| No airsoft-specific strings in Core | Domain workflows stay on Modules; Hero only brands + unique rules |

**Layer test:** bilingual routing and Payload locales are **Core ports**. “Airsoft event” wording packs are **Hero** (or Module defaults). Do not fork Events for HU/EN.

GTranslate on live ASN is explicitly **platform i18n later** in the Modules kickoff — this plan is that platform piece; Hero consumes it.

---

## 7. Phased PRs (merge one-at-a-time)

| Phase | PR focus | Ships | Out of scope |
| --- | --- | --- | --- |
| **P0** | Core i18n port + `next-intl` + public `[locale]` move | `src/core/i18n`, routing config, proxy compose, `(public)/[locale]`, `en` messages for login/layout chrome, Site Chrome locale list stub | Payload localized fields; Module namespaces; admin UI translation |
| **P1** | Payload `localization` + content bridge | Config locales; Pages localized fields; `content/*` takes `locale`; preview/search/sitemap/cache tags locale-aware | Localized slugs; Media alt; admin language cookie |
| **P2** | SEO + Nav polish | hreflang, locale switcher particle/chrome, Nav locale-aware links, redirect policy | Hero theme; GTranslate removal on live ASN host |
| **P3** | Module message contract | Manifest/`modules:generate` loads module `messages/*`; Forms/Consent/Email migrate hardcoded UI strings into namespaces | Translating every admin screen |
| **P4** | Admin UI locale (optional) | `adminLocale` preference + Core admin catalogs (`hu` partial OK) | Translating Payload’s own `/cms` chrome |
| **H** | ASN Hero | Default `hu`, Hero message pack, drop GTranslate on cutover | Rebuilding Modules for language |

**Build-order fit:** P0–P1 ideally land **before** Events (first Modules-wave pack) so Events registers `product:events` messages from day one. If Events starts first, require P3 contract in the Events PR checklist (no new hardcoded public strings).

---

## 8. Non-goals (v1)

- Domain-per-locale hosting (can add via `next-intl` domains later).
- Per-locale slugs / separate Nav trees per language.
- Machine-translation pipeline in Core (editors translate; optional LLM assist later via `LlmProvider`).
- Keeping GTranslate as production i18n.
- Localizing secrets/env editor labels beyond English.

---

## 9. Success criteria

- Public URLs resolve `/en/…` and `/hu/…` with correct UI strings **and** Payload field values.
- `/admin` and `/cms` unchanged in path shape; CMS locale switcher edits content.
- New Modules add messages without editing Core string tables by hand (codegen/manifest).
- Multilang can be limited via Site Chrome (enabled locales) without ripping routes.
- ASN Hero can set default `hu` and add a namespace without forking Events/Forms.

---

## Related

- [platform-module-layers](./platform-module-layers.md)
- [design-module-boundary](./design-module-boundary.md)
- [modules-wave-kickoff](./modules-wave-kickoff.md) (HU/EN + GTranslate → this plan)
- [modular-core](../principles/modular-core.md)
- [replaceable-modularity-plan](./replaceable-modularity-plan.md)
