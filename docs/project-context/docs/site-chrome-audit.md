# Site Chrome audit (SF-46)

**Scope:** PR [#25](https://github.com/seraxes/starforge/pull/25) / branch `cursor/site-chrome-admin-95c0` (ahead of `main`).  
**Plan:** [site-chrome-plan.md](./site-chrome-plan.md)  
**Question:** For each Site Chrome field — is it wired, does it belong here, and does it match 2024–2026 practice?

**Verdict:** Site Chrome is the right admin home for these site-wide policy fields. Most v1 fields are **persisted and runtime-wired**. Captcha is an honest **stub**. Biggest follow-ups: page SEO should inherit Chrome defaults, offline should speak HTTP 503, cookie **Secure** should follow production HTTPS, and captcha secrets/runtime should wait until real forms exist.

---

## What Site Chrome is (vs elsewhere)

| Area | Owns |
|------|------|
| **Site Chrome** | Site-wide policy & defaults: offline, captcha default, brand/SEO defaults, robots, rights, cookie scope |
| **Site Settings / Modules** | Feature & module on/off, primary nav *assignment* |
| **Nav manager** | Menu sets & items |
| **Layouts → Page settings** | Per-page/global *document* chrome (head/body/assets/layout id) — not site policy |
| **CMS page SEO** | Per-page meta title/description/image |
| **Env / deploy** | Secrets (captcha keys), production `Secure` cookies, absolute site URL |

Admin nav order on #25 matches prefs: Site Chrome → Site Settings → Navigation → Users → Layouts → CMS → Check site.

Storage: singleton `sf_site_chrome` (id `global`), separate from Payload `site-settings` and `sf_page_chrome`. Good split.

---

## Field-by-field

### 1. Site offline (`offlineEnabled` + `offlineMessage`)

| | |
|--|--|
| **Wired?** | **Yes.** Saved to DB; public layout replaces content for non-admins; `/login` and `/sign-out` stay open; app admins bypass and see a banner linking back to Site Chrome. |
| **Belongs?** | **Yes** — classic site-wide maintenance policy. Not Page Settings, not Modules. |
| **Modern practice** | Maintenance/offline toggles belong in site policy. Prefer **HTTP 503** (+ optional `Retry-After`) so crawlers and monitors treat the site as unavailable; soft “pretty 200” pages look like normal content. IP allowlists and scheduled windows are common upgrades (plan already lists allowlist / schedule as later). |
| **Gaps** | Response is still a normal 200 HTML screen (no 503). `/api/*` is not gated (auth, health, Payload REST stay up — often desirable for ops, but publish APIs are still reachable). No IP allowlist yet. |
| **Recommend** | **Keep.** Later: emit 503 for locked public HTML; optional IP allowlist; optional schedule. Do not move. |

---

### 2. Default sitewide captcha (`captchaEnabled` + `captchaProvider`)

| | |
|--|--|
| **Wired?** | **Stub / UI-only.** Values persist and normalize, but **no form or API reads them**. Labels already say “(stub)”. |
| **Belongs?** | **Yes** as the *default* for forms (enable + provider). Site keys / secrets belong in **env** (or a secrets store), not in this JSON. Per-form overrides can live on form modules later. |
| **Modern practice (2024–2026)** | Prefer **Cloudflare Turnstile** as the default UX for most contact/signup forms (low friction, free tier). Keep **reCAPTCHA** / **hCaptcha** as alternatives. Always **verify tokens server-side**; combine with honeypot + rate limits. Do not ship a “enabled” UI that does nothing once real forms land without verification. |
| **Gaps** | No site/secret key fields (correct for now — avoid DB secrets). No runtime helper. Provider enum is ready (`none` \| `turnstile` \| `recaptcha` \| `hcaptcha`). |
| **Recommend** | **Keep stub fields** until a forms/register abuse path needs them. When wiring: Turnstile-first; keys via env; server verify; forms opt into site default. **Do not** pretend it works before then. |

---

### 3. Site metadata (`siteName`, `defaultDescription`, `defaultOgImage`)

| | |
|--|--|
| **Wired?** | **Mostly yes.** Root public `generateMetadata` uses all three (title template, description, OG image + `siteName`). Brand / site-header particle prefer Chrome `siteName`. Save **syncs** `siteName` into Payload `site-settings.siteName`. Core Site Settings form keeps `siteName` as a hidden field so Modules save does not wipe it. |
| **Belongs?** | **Yes** — sitewide SEO/social defaults. Per-page overrides stay in **CMS page SEO**; document chrome stays in **Page settings**. |
| **Modern practice** | Sitewide defaults + page override chain is standard. Prefer absolute OG URLs, `metadataBase`, and Twitter/X card parity (`summary_large_image` when an image exists). Fallback order: page meta → site Chrome defaults → hardcode. |
| **Gaps** | `buildPageMetadata` (CMS pages) still hardcodes title suffix **“Starforge”** and does **not** fall back to Chrome description / default OG when page meta is empty. Layout metadata has Open Graph but **no Twitter card** block. Relative OG URLs are allowed as-is (no forced absolute). Dual `siteName` (Chrome + Payload) needs ongoing sync discipline. |
| **Recommend** | **Keep.** Fix inheritance so page SEO uses Chrome defaults. Add Twitter defaults alongside OG. Later: media picker for default OG; make Payload `siteName` clearly read-only / synced. |

---

### 4. Robots (`robotsMeta` + `robotsTxt`)

| | |
|--|--|
| **Wired?** | **Yes.** `robotsMeta` feeds Next Metadata `robots` (string form is supported). `robotsTxt` is served from `/robots.txt` (dynamic route). |
| **Belongs?** | **Yes** — sitewide crawl policy. Per-page `noindex` belongs on page SEO / Page settings, not here. |
| **Modern practice** | Keep **both**: `robots.txt` = path rules for crawlers; meta robots = per-document indexing. Free-text `robots.txt` is fine for power users; presets help novices. When a sitemap exists, include a `Sitemap:` line. Offline mode and “discourage indexing” are related but not the same as robots.txt. |
| **Gaps** | No sitemap yet → no guided `Sitemap:` helper. Free-text can be invalid with no validation. No structured Next `MetadataRoute.robots` (optional; custom route is OK). |
| **Recommend** | **Keep both fields.** Later: sitemap + auto `Sitemap:` hint; light validation / presets. Do not fold into Page Settings. |

---

### 5. Content rights (`contentRights`)

| | |
|--|--|
| **Wired?** | **Yes** as Copyright particle fallback when particle text is empty; otherwise particle / “All rights reserved.” |
| **Belongs?** | **Yes** — sitewide rights statement. Particle override is correct. Full legal URLs (privacy/terms) are plan “later”, not v1. |
| **Modern practice** | Sitewide copyright/rights string + optional legal link set is normal. Structured rights / license metadata is optional for media-heavy sites. |
| **Gaps** | No legal links block yet (deferred by plan). |
| **Recommend** | **Keep.** Add legal links later under Site Chrome (not Modules). |

---

### 6. Cookie domain and path (`cookieDomain`, `cookiePath`)

| | |
|--|--|
| **Wired?** | **Yes, for Domain/Path.** Shared mutable `siteChromeCookieAttributes` is passed into Better Auth `defaultCookieAttributes`. Load/save applies domain/path in-process. |
| **Belongs?** | **Mostly yes**, with caution. Domain is a real ops knob (apex vs subdomain SSO). Path is rarely changed for a whole-site session cookie (`/` is correct). **SameSite** and **Secure** are *not* admin fields today (hardcoded `sameSite: 'lax'`, `secure: false`, `httpOnly: true`). Production Secure often belongs with **env / HTTPS detection**, not a casual checkbox. |
| **Modern practice** | Defaults: **host-only** domain (empty), `Path=/`, `HttpOnly`, `SameSite=Lax`, **`Secure` in production HTTPS**. Only set `Domain` when sessions must span subdomains; wrong values break login. Prefer `__Host-` / `__Secure-` prefixes when the stack supports them (Better Auth naming). |
| **Gaps** | `secure: false` and `useSecureCookies: false` are intentional for local HTTP but unsafe if left for production HTTPS. Cookie attrs are process memory — cold auth requests before Chrome load keep code defaults (usually fine if defaults match empty Chrome). Multi-instance: each worker must load Chrome before relying on custom domain (OK once public/admin traffic hits). No UI for SameSite. |
| **Recommend** | **Keep Domain** (with warnings / examples). **Keep Path** as advanced (default `/`). **Do not** expose Secure as a free toggle without tying it to HTTPS. Later: auto-Secure from env/`NODE_ENV`/request; optional advanced SameSite. Consider documenting or env-mirroring `COOKIE_DOMAIN` for deploy-time config. |

---

## Other fields present?

None beyond the plan’s v1 set. Captcha providers are enumerated but stubbed. No maintenance schedule, legal links, or hreflang (correctly deferred).

---

## Cross-cutting findings

1. **IA is sound** — Chrome vs Settings vs Nav vs Page settings matches the plan and prefs.  
2. **Persistence model is sound** — `sf_site_chrome` singleton JSON, cache tag `sf:site-chrome`, seed helper, ACL resource `admin.site-chrome` registered (gate still “any app admin” like other core admin areas).  
3. **siteName dual-write** — Chrome is source of truth on save; Payload retains a copy for legacy/header consumers. Acceptable short-term; avoid editing name in Payload.  
4. **Page SEO not fully chained** — strongest functional gap for “defaults that actually cascade.”  
5. **Offline ≠ crawl policy** — offline hides HTML for visitors; robots/meta still apply when online. Consider `noindex` while offline only if you also serve indexable shells (today offline replaces the page).  
6. **Secrets** — do not store captcha private keys in Site Chrome JSON.

---

## Scorecard

| Field | Wired | Belongs in Site Chrome | Action |
|-------|-------|------------------------|--------|
| Offline + message | Runtime | Yes | **Keep**; add 503 (+ allowlist later) |
| Captcha enable/provider | Persist only (stub) | Yes (defaults) | **Keep stub**; wire with forms + env keys |
| Site name | Runtime + sync | Yes | **Keep**; treat as SoT over Payload |
| Default description | Runtime (root) | Yes | **Keep**; inherit into page SEO |
| Default OG image | Runtime (root) | Yes | **Keep**; absolute URL + page fallback |
| Robots meta | Runtime | Yes | **Keep** |
| robots.txt | Runtime | Yes | **Keep**; sitemap line later |
| Content rights | Runtime (particle) | Yes | **Keep**; legal links later |
| Cookie domain | Runtime (Better Auth) | Yes (ops) | **Keep** + warnings |
| Cookie path | Runtime | Yes (advanced) | **Keep**; default `/` |
| SameSite / Secure | Code only | Env / advanced | **Defer UI**; auto-Secure for prod |
| Maintenance schedule / legal / hreflang | Absent | Yes when built | **Defer** (per plan) |

---

## Recommended next steps (priority)

1. **Inherit Site Chrome into `buildPageMetadata`** (name, description, OG) so CMS pages get real defaults.  
2. **Offline → 503** for locked public HTML responses.  
3. **Production cookie Secure** from env/HTTPS (keep localhost HTTP working).  
4. **Wire captcha** only when a form surface needs it; Turnstile-first; keys in env.  
5. **Sitemap** (+ robots.txt `Sitemap:` helper) when public URL inventory exists.  
6. Legal links / hreflang / offline IP allowlist — stay on the plan’s later list.

No code changes in this audit; no PR opened.
