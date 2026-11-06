---
cursor:
  subagentId: "bc-4d38b236-3d6b-57b9-b8c4-72e67a53bb42"
---

# Starforge Core — architecture audit (Opus, SF-136)

**Scope:** `seraxes/starforge` `main` @ `f8a3640` (includes Redis cache [#76](https://github.com/seraxes/starforge/pull/76) + Form upload/hidden [#75](https://github.com/seraxes/starforge/pull/75)) plus open spine PRs [#77](https://github.com/seraxes/starforge/pull/77) (S3/Spaces) and [#78](https://github.com/seraxes/starforge/pull/78) (security headers). Read-only. Paths are repo-relative to `/agent/repos/starforge`.
**Builds on:** [stack-architecture-coherence](../internal/stack-architecture-coherence.md) (Nov 2) — not repeated here except where still open.

**Verdict:** The direction holds up: one login, schema isolation, and Mailer/cache ports behind interfaces are all good. Two things are weak. First, the **Module layer is a concept, not a code boundary**: every "module" today means editing Core. Second, the **public write paths (Form uploads, Payload globals, deploy/migrations) have not been hardened** to the level the feature velocity assumes. Fix the security and deploy items before more spine features, and define a module contract before SF-130/131/133 add more code to Core.

---

## Top 5 findings

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 1 | **Critical** | **Form file uploads are public, pre-captcha, and accept SVG.** Respondent attachments go into the Media library with `read: () => true`, so `/api/media?where[folder][equals]=forms` and `/api/media/{id}` expose them to anyone. Upload runs **before** field validation and Turnstile. Anonymous SVG is allowed (stored XSS on your origin). The legacy path trusts client-supplied `fieldsJson`, including the file field's `accept` and `maxSizeBytes`. Also, all uploads go through Server Actions with Next's **1 MB default body limit**, so phone photos and the advertised 10 MB attachments fail. | Validate → captcha → rate-limit → *then* upload. Drop SVG from the anonymous allowlist. Ignore `file` fields on the legacy `fieldsJson` path, or remove that path for public submit. Make `folder=forms` (or a `private` flag) unreadable in Media `access.read` and serve it through an admin-gated route. Set `experimental.serverActions.bodySizeLimit` to match the max upload. |
| 2 | **High** (deploy blocker) | **No migrations and no CI.** Core uses `drizzle-kit push` (README); the `src/core/db/migrations` dir doesn't exist. Payload's Postgres adapter only auto-pushes in dev, and there are no Payload migrations. There's no `.github/workflows`, no unit tests, and no typecheck gate across about 76 agent-merged PRs. Several "restore/regression" PRs (#74, layout-chrome regression) show the cost. | Generate baseline migrations now (`drizzle-kit generate` and `payload migrate:create`). Add CI: `tsc --noEmit`, `eslint`, and `node:test`/vitest on the pure engines (`forms/expr`, `logic`, `evaluate`, `date-constraints`, `modules/grid`). Do this before SF-6 hosting. |
| 3 | **High** | **Authz gaps around admin surfaces.** (a) The Payload `site-settings` global has `update: Boolean(user)`, so any member granted CMS access can flip module toggles or registration through Payload's UI/REST, bypassing Core's admin-only page. (b) An empty `STARFORGE_DEVELOPER_ADMIN_EMAILS` means **every admin is a developer-admin**, which unlocks script fields, the analytics atom, and the Environment editor. (c) The ACL matrix isn't enforced: `viewerMayAccessAdminResource` has zero callers. (d) The Form rate limit keys on the **first** `X-Forwarded-For` hop, which clients can spoof. | (a) Gate on the Core role (look up the stub's `coreUserId` → `sf_users.role`). (b) Fail closed when `NODE_ENV=production`. (c) Either wire the matrix into `requireAppAdmin` per area or label it "preview" in the UI. (d) Trust only the proxy-appended hop (`x-real-ip` from nginx, or the rightmost XFF entry). |
| 4 | **High** (structural) | **"Modules" aren't a code boundary.** Forms (`src/core/forms`, DB tables in `core/db/schema.ts`) and Media (`src/core/media`) live in Core and are re-exported from `core/index.ts`. The Layout host has per-particle actions (`updateLogo/Menu/Copyright/Social/FormSlotAction`, `core/modules/actions.ts` L1114–1318), a per-particle `switch` (`particles/config.ts` L144), and a 967-line `typed-particle-editors.tsx`. Admin nav is hardcoded (`admin-nav/build.ts` L65–97). There are **two catalogs** with the same ids/labels/navViews (`modules/installable-manifest.ts` and `core/settings/module-catalog.ts`). Core imports `@/modules/catalog` (dependency points the wrong way). Media isn't in the allowlist at all. Net effect: Events, Maps, Consent, or Hero **must edit Core**, which breaks the layer rule. | Define a small `StarforgeModuleManifest` (id, particles, `configSchema` + `normalize`, editor component, `adminNav[]`, settings panel, optional schema file). Generate the one catalog from it. Make SF-130 (sitemap/redirects) or SF-131 (consent) the first module built against it, then migrate Form's particle editor/action. Don't do a big-bang move of `core/forms`; the engine can stay a shared lib. |
| 5 | **Medium–High** | **PR #78's CSP will break shipped features, and docs already call it shipped.** `script-src`/`style-src`/`font-src`/`connect-src 'self'` blocks the Font Awesome cdnjs pack (`page-settings/font-awesome.ts` L9–14), the analytics gtag atom (`atoms/analytics.ts` L101), Page Settings external CSS/JS asset URLs, and future MapProvider tiles. `csrf: []` in `payload.config.ts` L47–48 also remains (accepts the cookie JWT from any Origin). `core-modules-inventory.md` marks SF-129 **shipped** and Redis **stub**; both are wrong (#78 is open, #76 merged). | Before merging #78: build CSP sources from config (FA CDN when enabled, analytics hosts when the atom is on, Page Settings asset origins), or ship `Content-Security-Policy-Report-Only` first. Set Payload `csrf: [appOrigin()]`. Coordinator: correct the inventory Security, Jobs/Redis, and Cache rows. |

---

## 1. Core / Modules / Hero fit

| Layer | Intended ([platform-module-layers](./platform-module-layers.md)) | Actual in code | Gap |
| --- | --- | --- | --- |
| **Core** | Skeleton + ports + module host | Skeleton + ports **+ Forms + Media + all particle editors/actions + admin IA** | Core is the monolith; "module" = particle `render()` only |
| **Modules** | Toggleable packs that own behavior | `src/modules/{form,notice-bar}` = render shims; real logic in `src/core/*` | No contract for admin routes/nav/settings/DB per module |
| **Hero** | Theme + rules on top | Nothing yet (correct per build order) | **No public-theme port** (brand tokens hardcoded in `styles.css :root`), no extension seam for vertical fields on Module entities |

**Recommendations**
- **Lock a data-home rule before Events/Maps:** editorial content with drafts, versions, rich text, or media galleries → Payload collections. Transactional or high-write data (submissions, registrations, location shares, votes) → Drizzle `sf_*`. The Events plan currently says "sf_* or Payload".
- **Hero extension seam:** namespaced `extensions` JSON on module documents, or Payload config plugins that add fields. Decide when Events lands, not now.
- **Public theme port (later, before Hero):** mirror `admin-theme`, with a registry of `{ tokens, cssEntry }` selected by env or Site Settings. ASN dark then becomes a theme entry, not CSS overrides.
- Keep **planned-only ports planned-only** (`LlmProvider`, `MapProvider`, `MediaAnalysisPort`). Don't stub code ahead of a consumer; earlier stubs (Redis cache that throws, S3 `info()`) produced footguns.

## 2. Ports

| Port | Shape | Status | Issues |
| --- | --- | --- | --- |
| **Auth** (Better Auth) | Platform | Solid | `trustedOrigins` hardcoded localhost (prod relies on baseURL fallback; make env-driven). No `rateLimit.storage` / `secondaryStorage`: per-instance memory once multi-node. Recovery/OTP/magic-link endpoints have no captcha option. |
| **Mailer** | `send()` + factory; adapters console/SMTP/Resend | **Best-shaped port** | Fine. Sync send with fire-and-forget for auth mail is OK on a long-running Node droplet. Templates later. |
| **Redis / cache** | `PublishedContentCache` + shared `ioredis` | Shipped (#76) | (a) `revalidate: false` + `null` results ⇒ **every probed random slug creates a permanent key** (`redis.ts` L72–77, `pages.ts` L48–51). Set a TTL on misses. (b) Tag sets never expire or trim. (c) `invalidateTags` is fire-and-forget, so save → redirect can read stale; return a `Promise` and await it in actions. (d) No key prefix: add `STARFORGE_REDIS_PREFIX` for staging/multi-site sharing one Redis. (e) Redis exists now but the Form rate limit and Better Auth still use memory. |
| **MediaStorage** | `info()` only; #77 adds official `@payloadcms/storage-s3` | Right call (don't hand-roll I/O) | (a) `s3` selected with incomplete env ⇒ plugin returns `null` and **Payload silently writes local disk**, while Core upload shows "not ready", giving split-brain files. Throw at boot in production. (b) `acl: public-read` + `disablePayloadAccessControl: true` makes Form attachments world-readable on Spaces too. Use a private prefix/collection for attachments. Document that the "port" is plugin selection, not a Starforge I/O interface. |
| **Security** | #78 headers + `shouldUseSecureCookies()` | Open PR | Good signal design (URL → Secure + HSTS). CSP conflicts (Top 5 #5). `Permissions-Policy geolocation=()` will need opening for Maps. **Captcha + rate-limit live in `core/forms`**; move them to `core/security` so auth and other modules reuse them. `recaptcha`/`hcaptcha` are selectable and **fail open** (`forms/captcha.ts` L43–49): hide them until wired. |

## 3. Form engine

**Strong:** a single shared evaluate path (client + server), a safe expression parser (no `eval`), conditional logic stronger than RSForm's basic UI, a Layout-aligned builder, and presets as seeds.

| Issue | Evidence | When |
| --- | --- | --- |
| Upload order, public attachments, SVG, client `fieldsJson`, 1 MB limit | Top 5 #1. `forms/actions.ts` L150–192; `media/form-upload.ts` L35–49, L149–163; `collections/Media.ts` L41–43; `next.config.ts` (no `serverActions`) | **Now** |
| Submissions are not interpretable over time: definitions mutate on autosave, and submissions store no version or field snapshot | `db/schema.ts` L292–317 | **Before SF-133 CSV export** |
| `payload` is `text` JSON of `Record<string,string>`; checkbox-group is comma-joined (values containing commas break); no `userId` | `forms/store.ts`, `forms/actions.ts` L58–63 | **Before event-registration/voting presets** (capacity, one-per-user need queryable `jsonb` + `user_id`) |
| "Editable" JSON Schema is write-only. Runtime uses `fields`, so a dirty schema has no effect (dual source of truth) | `forms/actions.ts` L386–397; no runtime reader of `.schema` | Soon. Make it read-only export or one-way import → fields |
| Misnamed `validateFieldsWithZod` (no Zod) plus a throwing `fieldsToZodSchema` stub | `forms/schema-zod.ts` | Soon (rename) |
| Legacy inline-fields particle path keeps a second definition source | `modules/form/index.ts`, `forms/actions.ts` L150–160 | Later. Migrate inline slots to definitions, then delete |

## 4. Layout / admin theme

- **Layout host:** document model and grid are clean. Extensibility is not: per-particle server actions and editors are hardcoded in Core (Top 5 #4). Big files are a regression magnet: `layout-editor.tsx` 1,568 lines, `form-builder.tsx` 1,533, `modules/actions.ts` 1,374, `typed-particle-editors.tsx` 967.
- **Public request cost:** layout doc, Page Settings chrome, nav menus, and groups are **uncached DB reads per request**. Only pages, Site Settings, and Site Chrome use the cache port. The middleware still does an internal HTTP `fetch` to `/api/site-chrome/offline-gate` on every public HTML request. Fine locally; extend the cache port and read in-process before scaling.
- **Admin theme port:** `STARFORGE_ADMIN_THEME` selects tokens/`dataAttr`, but the CSS import is hardcoded in `app/(frontend)/layout.tsx` L6 and `(payload)/layout.tsx`, so the env switch doesn't switch the look. That's acceptable with one theme; document it honestly.
- **CSS bundling:** the root frontend layout imports `styles.css` (4,048 lines, about 200 admin/Gantry rules) **and** `core-chrome.css` (2,417 lines), so every public visitor downloads admin CSS. Rules are mostly scoped to `.admin-shell` (bloat, not leakage). Move the admin import into `app/admin/layout.tsx` and split admin rules out of `styles.css` before the public theme port.

## 5. Coupling / debt (carry-overs still open)

- Two writable stores for site config: Payload `site-settings` global (`feature*` + `moduleToggles` + hidden `primaryNav`) alongside Core UI. Plus the authz gap in Top 5 #3a.
- Core → Modules import inversion (`core/modules/{actions,PublicLayoutBody,SlotRenderer}` → `@/modules/catalog`).
- Duplicate catalogs: `installable-manifest.ts` and `module-catalog.ts`.
- Payload stub passwords; `PAYLOAD_SECRET || ''`; `csrf: []`.

---

## Fix now vs later

| When | Items |
| --- | --- |
| **Now** (ahead of SF-130/131) | Form upload hardening + `bodySizeLimit` (Top 5 #1). Payload `site-settings` update → admin only. Developer-admin fail-closed in prod. Rate-limit IP from trusted proxy hop. Fix #78 CSP + Payload `csrf` before merge. Make #77 throw on incomplete S3 env + use private attachments. Baseline migrations + CI with engine unit tests. Correct inventory doc drift. |
| **Soon** (before the next Module and SF-133) | `StarforgeModuleManifest` + one generated catalog + module-contributed admin nav/particle editors. Submissions → `jsonb` + `definition_version`/field snapshot + `user_id` + array values. JSON Schema read-only. Redis miss-TTL, prefix, awaited invalidation. Redis-backed rate limit + Better Auth secondary storage. Move captcha/rate-limit into `core/security`. Hide unwired captcha providers. |
| **Later** (before Hero / scale) | Public theme port + admin CSS split. Cache layout/page-chrome/nav + in-process offline gate. Split the 1.5k-line editors. Data-home rule + Hero extension seam. Enforce or relabel the ACL matrix. Retire legacy inline Form fields, `feature*` flags, `primaryNav`, Payload stub passwords. Open `geolocation` in Permissions-Policy when Maps ships. |

## Mistakes / risks to watch

1. **Velocity without guardrails.** About 76 PRs in 4 days, agent-merged, with no tests or CI. Regressions are already recurring. CI is the cheapest risk reduction available.
2. **Doc ≠ code drift.** The inventory claims SF-129 shipped and Redis is a stub. The layer doc calls Forms/Media "Modules" while the code puts them in Core. Decisions made from docs will be wrong.
3. **"Toggleable" ≠ "removable".** Runtime toggles exist, but Forms/Media code, tables, and nav ship in Core regardless, which works against the "no deadweight" preference. Media isn't toggleable at all.
4. **Single public Media library vs private intake.** "One library" is right for site assets but wrong for respondent PII. Keep one *store*, but treat ACL/privacy as a first-class Media field now, not "later".
5. **Port over-design.** Three future ports are fully specified in plans. Keep them on paper until a consumer ships; spend the effort on the ports already in production paths (security, rate-limit, storage).
