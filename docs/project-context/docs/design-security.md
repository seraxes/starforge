---
cursor:
  subagentId: "bc-0ab719b5-2646-52f8-8a6c-6069013cc077"
---

# Starforge design — security target

**Status:** target design. Current gaps and evidence are in [architecture-opus-audit](./architecture-opus-audit.md) (state at `main` @ `812b8f5`: #77/#78 merged; CSP, `csrf`, and upload gaps still open). Overview: [design-system-overview](./design-system-overview.md).

## 1. Trust model

| Actor | May do | Gate (target) |
| --- | --- | --- |
| Anonymous | Read published pages/public media; submit forms; register (if on) | Module toggles, captcha, rate limit |
| Registered member | Account security; group-tagged content | Better Auth session |
| CMS editor (`cms_access`) | Payload pages/media editing | Payload access derived from **Core** user |
| App admin (`role=admin`) | Core admin areas | `requireAdminArea(key)` |
| Developer-admin | Script-capable fields (Custom JS, head HTML, analytics atom), Environment editor | Explicit email list; **fail closed in production** |

**Single source of truth:** the Core `sf_users` role and groups. Payload access functions must ask Core; they must not treat "has a Payload user" as authority.

## 2. Form submission pipeline (fixed order)

```
1  module gate (product:forms + form particle on)
2  resolve definition SERVER-SIDE (definitionId → sf_forms; legacy inline → read slot config
   from layout doc by layoutId/slotId; never trust client fieldsJson)
3  honeypot
4  rate limit (RateLimiter: per IP+form; per IP upload bytes)
5  captcha verify (if required)
6  validate non-file fields (evaluate path)
7  validate files: size ≤ field max ≤ global cap; extension allowlist AND content sniff
   (images via sharp metadata; PDF `%PDF-` magic; DOCX zip header); no SVG/HTML from anonymous
8  store files as PRIVATE media (visibility=private, folder=forms)
9  insert submission (definition version + field snapshot + optional user_id)
10 notify via Mailer (soft-fail)
On any failure after 8 → delete the just-created media (no orphans).
```

**Limits:** `experimental.serverActions.bodySizeLimit` in `next.config.ts` = global upload cap (e.g. `12mb`; admin Media and Form both use Server Actions). Nginx `client_max_body_size` must match. Per-field `maxSizeBytes` is clamped to the global cap on save **and** on submit.

## 3. Media ACL (one library, public and private files)

Keep **one** Payload `media` collection (preference). Privacy is a first-class field, not a second store.

| Field | Values | Default |
| --- | --- | --- |
| `visibility` | `public` \| `private` | `public` for library uploads; **forced `private`** for `folder=forms` |
| `accessTags` (later) | Group tags, OR match | Empty = per `visibility` |

- **Payload `access.read`:** public → anyone. Private → Core app admin, or a Forms admin for `folder=forms`. Return a `where` constraint so lists filter too.
- **File bytes:** keep Payload access control **on** for the collection (remove `disablePayloadAccessControl: true` from `payload-plugin.ts`), so file requests go through Payload's access check. Public images may still use the CDN URL via `generateFileURL` when `visibility=public`. Private files use the plugin's signed-download option (verify the option name on storage-s3 3.92) or stream through an admin-gated Core route. Set the S3 `acl` to `private` for private uploads.
- **`/api/media/[id]`:** resolve only `visibility=public`; return 404 otherwise.
- **SVG:** anonymous never. Admin SVG is allowed only for developer-admins. Prefer PNG logos (already the pipeline rule).
- **Fallback exception:** if proxying private files through Payload costs too much bandwidth, split a `form-attachments` upload collection as a *documented* exception to one-library ([modular-core](../principles/modular-core.md) "Stops when").

## 4. Cookies, CSRF, CSP

**Cookies (shipped, keep):** `shouldUseSecureCookies()`: explicit `STARFORGE_SECURE_COOKIES`, else `https://` app URL, else `NODE_ENV=production`. Secure + `__Secure-` prefix + HSTS on HTTPS. SameSite=Lax, httpOnly.

**Add:**
- Payload `csrf: [appOrigin()]` (today `[]` accepts the cookie JWT from any Origin).
- Better Auth `trustedOrigins` = `BETTER_AUTH_URL` origin + optional `STARFORGE_TRUSTED_ORIGINS` (comma-separated); keep localhost entries only when the URL is `http://localhost`.
- At boot in production: refuse `http://` app URL unless `STARFORGE_SECURE_COOKIES=0` is explicit ([design-data-deploy](./design-data-deploy.md) §3).

**CSP target:** a composed policy, not a static string.

| Source group | Added when | Directives |
| --- | --- | --- |
| Baseline | Always | `default-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'self'` |
| Next/Payload runtime | Always (until nonces) | `script-src 'unsafe-inline' 'unsafe-eval'`; `style-src 'unsafe-inline'` |
| Turnstile | Captcha provider = turnstile | script/connect/frame `challenges.cloudflare.com` |
| Font Awesome CDN | `product:font-awesome` on, no override | style + font `cdnjs.cloudflare.com` |
| Analytics atom (Google) | Atom on **and** consent granted path | script `www.googletagmanager.com`; connect `*.google-analytics.com`, `*.analytics.google.com` |
| Spaces/CDN | `STARFORGE_MEDIA_STORAGE=s3` | img/media `S3_PUBLIC_BASE_URL` origin |
| Page Settings assets | External CSS/JS URLs saved | Their origins, computed on save |
| Admin extra | Settings → Security "Allowed external sources" | Validated origins (non-secret, DB OK) |
| Module contributions | Module manifest `csp` | Per [design-module-boundary](./design-module-boundary.md) |

**Mechanics:** move `middleware.ts` → Next 16 `proxy.ts` (Node runtime). The proxy reads one cached `security-policy` document through `PublishedContentCache` in-process: CSP sources, redirects, offline flag. That removes today's two internal HTTP hops. Roll out with `Content-Security-Policy-Report-Only` for one cycle, then enforce. **Later:** nonce-based `script-src` to drop `'unsafe-inline'`.

`Permissions-Policy`: keep `camera=(self)`; open `geolocation=(self)` when the Maps module is enabled (module manifest contribution).

## 5. ACL target

- **Role** stays thin: `admin` | `member` (+ developer-admin list).
- **Admin areas:** `requireAdminArea(key)`. Global admin → all areas. Otherwise allowed if any of the user's groups has a grant for `key` in `sf_acl_permissions` (Joomla-style Manager = a group, not a role). Area keys come from Core plus module manifests.
- Until wired: the Users → ACL screen shows "not enforced yet" (today `viewerMayAccessAdminResource` has no callers).
- **Payload:** helpers `isCoreAdmin(req)` / `hasCmsAccess(req)` read Core via `coreUserId`.
  - `site-settings` global `update` → `isCoreAdmin`. Today any CMS user can flip module toggles or registration.
  - `users` stub → read for admins only.
  - `pages` / `media` writes → `hasCmsAccess`.
- **Developer-admin:** an empty `STARFORGE_DEVELOPER_ADMIN_EMAILS` → nobody in production (everybody locally). Show a Settings → Security warning when empty.
- Viewing ACL (Nav/slots/Page Settings group tags) is already correct. Keep it.

## 6. Rate limiting and client IP

**Port:** `RateLimiter.consume(key, { limit, windowSec }) → { ok, retryAfterSec }` in `core/security/rate-limit`. Memory adapter locally; Redis adapter (`INCR` + `EXPIRE`, same `REDIS_URL` + prefix) when Redis is configured.

| Bucket | Default |
| --- | --- |
| Form submit per IP + form | 8 / 60 s |
| Form upload bytes per IP | 50 MB / hour |
| Redirect/admin APIs | none (admin-gated) |
| Auth | Better Auth `rateLimit` with `storage: 'secondary-storage'` + Redis `secondaryStorage` when Redis is on |

**Client IP:** `clientIp(headers)` in `core/security`. Trust `x-real-ip` set by our nginx, or the rightmost `STARFORGE_TRUSTED_PROXY_HOPS` entries of `X-Forwarded-For`. **Never the first XFF hop** (client-spoofable, which is what the Form limiter uses today).

## 7. Captcha

- Move `core/forms/captcha.ts` → `core/security/captcha` as a provider interface `{ siteKey(), verify(token, ip) }`.
- Turnstile only. **Hide** reCAPTCHA/hCaptcha from the Settings select until wired; today they fail open.
- Settings → Security: per-surface toggles (forms default, register, forgot-password/magic-link/OTP request), so auth recovery endpoints can't be used to email-bomb people.

## 8. Secrets (unchanged)

`PAYLOAD_SECRET`, `BETTER_AUTH_SECRET`, `TURNSTILE_SECRET_KEY`, SMTP/Resend, `S3_*` keys, `REDIS_URL` with credentials: env or the gitignored `.env.local` overlay via the gated Environment editor only. Never the DB, never logs.

## Fix order

| # | Item | Size |
| --- | --- | --- |
| 1 | Form pipeline order + server-side definitions + file sniff/no SVG + orphan cleanup | M |
| 2 | Media `visibility` + Payload access on + `/api/media/[id]` public-only | M |
| 3 | `bodySizeLimit` + clamp per-field max | S |
| 4 | Payload `site-settings` update → Core admin; developer-admin fail-closed in prod | S |
| 5 | `clientIp()` trusted hop + `RateLimiter` port (memory; Redis adapter) | S–M |
| 6 | Payload `csrf: [appOrigin]`; env-driven `trustedOrigins` | S |
| 7 | CSP composition (report-only → enforce) + `proxy.ts` in-process policy doc | M |
| 8 | Captcha → `core/security`; hide unwired providers; auth-surface toggles | S–M |
| 9 | `requireAdminArea` + ACL matrix enforcement | M |
