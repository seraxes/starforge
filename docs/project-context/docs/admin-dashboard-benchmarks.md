# Admin dashboard benchmarks → Starforge next

**Scope:** What `/admin` should add **beyond** [admin-dashboard-plan](./admin-dashboard-plan.md) (users strip, Media/Email cards, `admin.dashboard[]`, refresh setting, Events/Marketplace stubs).  
**Lens:** WordPress, Joomla 4/5, Drupal CMS, Ghost, Strapi 5, Payload modular dashboard, Shopify Home, Vercel project overview, Cloudflare Security/Analytics, Linear/Notion-style ops inbox.  
**Constraint:** Host stays Core; packs contribute widgets; no Hero chrome; keep `/cms/admin` separate.

---

## Already covered (do not re-plan)

| Peer pattern | Starforge owner |
| --- | --- |
| At-a-glance users / presence | Core Auth |
| Library / media footprint | `product:media` |
| Transactional send volume | `product:email-manager` (+ Mailer port) |
| Plugin/module cards when enabled | `admin.dashboard[]` host |
| Events / shop listing counts | Module stubs → real on ship |

---

## Must-have soon

Ship after D0–D4 (or as thin follow-ons). Each item is a glance card or strip with a **link out** — not a full report UI.

| # | Item | Why (peers) | Owner | Actionable Starforge slice |
| --- | --- | --- | --- | --- |
| 1 | **Needs attention** strip | WP Site Health widget; Joomla Notifications; Shopify order tasks; Vercel firewall chip; ops-inbox “failures first” | **Core** host + optional module row contributions | Single rail: severity · short label · deep-link. Seed from Core: site offline, Mailer disabled, env boot warnings (developer-admin only), `/api/health` fail (DB/Redis/`MediaStorage`). Modules append via `admin.dashboard` `size: sm` or a shared `attention[]` contribution if you extend the contract once. |
| 2 | **System health** chip/card | WP Site Health; Vercel Observability preview; Cloudflare Security overview (posture, not charts) | **Core** | Reuse smoke health: DB · Redis (when selected) · MediaStorage ready · migration version. Green/amber/red + link to Site Chrome / Environment. No secrets in payload. |
| 3 | **Form submissions** card | WP Activity (moderate); Shopify tasks; Strapi entry counts | **Module** `product:forms` | Counts: total · last 24h/7d · unread/new if you have a read flag (else “latest 5” list). Link to Forms submissions. Hide when Forms off. |
| 4 | **Site Chrome status** | WP “search engines discouraged”; Joomla Site Information; Cloudflare SSL/traffic posture lite | **Core** Site Chrome | Tiny chip already hinted in plan: offline mode, indexing/robots discourage, captcha policy on/off. One row, not a settings form. |
| 5 | **Admin activity (latest actions)** | WP Activity; Joomla Latest Actions; Strapi last edited/published | **Core** (thin) | Last ~10 mutating admin actions (who · what · when) once an audit/action log exists. Until then: skip UI, don’t fake it from console. Prefer Core audit table + ACL; Modules do not own the feed. |
| 6 | **Modules enabled** summary | Joomla Plugins/Modules shortcuts; Strapi project statistics | **Core** Module Manager | Count enabled / allowlisted / disabled + “open Modules settings”. Surfaces broken toggles without opening Settings → Modules. |

**Contract note:** Prefer existing `admin.dashboard[]` for #3 and any module attention rows. #1/#2/#4/#5/#6 are Core builtin / host-manifest widgets (`order < 50`), same as users strip.

---

## Nice later

| Item | Owner | When / why |
| --- | --- | --- |
| **Consent / privacy queue** | Module `product:consent` | Joomla privacy requests. Ship with Consent pack: pending requests count + link. |
| **Redirects / SEO hygiene** | Module redirects (+ sitemap helpers) | Broken/loop count or “N redirects”; link to Redirects admin. |
| **Search / taxonomy pulse** | Module search/taxonomy | Tag/category counts or empty-index warning — only if cheap. |
| **Posts / content pulse** | Module Posts (when exists) | Strapi last published/edited — draft vs published counts; never duplicate Payload collection cards on `/admin`. |
| **Notifications unread** | Module Notifications | Bell count when in-app notifications exist. |
| **Marketplace / Shop ops inbox** | Module Marketplace/Shop | Shopify-style fulfill / capture / risk tasks — with those packs, not before Payments port is real. |
| **Events registrations triage** | Module Events (+ Forms) | Beyond stub counts: waitlist / pending approval rows when Events defines workflow. |
| **User-rearrange / hide widgets** | Core host | WP Screen Options; Strapi/Payload edit layout. Explicitly out of v1 plan — revisit after ≥6 real cards. |
| **Soft trend sparklines** | Per-widget owner | Ghost/Shopify metrics. Only if same stats loader already returns window series; no new analytics stack. |
| **Quick-create shortcuts** | Core host + module `createHref` | Joomla Site icons (+). Optional second row: New user / New form / Upload media — contribution field, not Core hardcode. |

---

## Skip or Hero-only

| Peer feature | Verdict |
| --- | --- |
| WP Events and News / community feed | **Skip** — noise on ops home. |
| WP Quick Draft | **Skip** — wrong surface; content lives in Payload/Posts. |
| Merge Payload `/cms/admin` home into `/admin` | **Skip** — locked separate. |
| Shopify Sidekick / AI recommendation cards | **Skip** (Core) — optional Hero later if a vertical wants it. |
| Full traffic / sales / threat charts (Ghost Analytics, Cloudflare Analytics, Shopify Insights) | **Skip** on `/admin` — link out to Analytics/Firewall products when those exist; Dashboard stays glance + triage. |
| Anonymous visitor “online now” | **Skip** — plan already: auth presence only; public traffic ≠ admin. |
| Per-role / per-user saved layouts early | **Skip** until rearrange ships. |
| ASN / milsim / catalog-fee KPIs | **Hero-only** — never Core widgets. |
| Marketing “stats strip” chrome | **Skip** — plan forbids. |
| Multi-dashboard Cpanel positions (Joomla Content/Users/… homes) | **Skip** — one `/admin` host + module cards; area-specific lists stay in module nav. |

---

## Suggested order after current plan

1. **D0–D4** as planned (host + users + Media + Email + refresh).  
2. **Core System health + Chrome status + Modules summary** (cheap, always-on).  
3. **Needs attention** rail (Core seeds; modules append).  
4. **Forms submissions** card with Forms module.  
5. **Admin activity** when audit log exists.  
6. Pack-specific triage (Consent, Redirects, Events, Shop) **in the same PR** that ships each module’s data — not Core stubs.

---

## Success check

- New glance items appear/disappear with module toggles (no Core `if (flags.forms)` list of product cards).  
- First viewport answers: *who’s here*, *is the site healthy*, *what needs a click* — then Media/Email/module grid.  
- No second analytics product and no Hero widgets on `/admin`.
