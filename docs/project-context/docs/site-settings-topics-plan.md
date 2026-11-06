# Site Settings topics plan (SF-113 / SF-116)

Split the monolithic Core **Site Settings** page into an expandable sidebar submenu by topic.

## Decisions (locked)

| Topic | Route | Owns |
| --- | --- | --- |
| **Modules** | `/app/admin/settings` (landing) | Installed module on/off + primary nav menu assignment |
| **Admin UX** | `/app/admin/settings/admin-ux` | Autosave debounce (ms) |
| **Auth & registration** | `/app/admin/settings/auth` | Registration enable (+ later passwordless / 2FA site policy) |
| **Security** | `/app/admin/settings/security` | Captcha enable/provider; honeypot / rate-limit / headers (stubs now) |
| **Performance** | `/app/admin/settings/performance` | Stub for cache / Redis later |

### Renamed (SF-116)

**Integrations** → **Security**. Old route `/app/admin/settings/integrations` redirects to `/security`. Not a separate Integrations topic.

### Out of Site Settings

| Concern | Home |
| --- | --- |
| Offline / SEO / cookies / outbound email / Environment | **Site Chrome** (unchanged) |
| Font Awesome enable + CDN options | **Layouts → Page settings** (FA panel); product gate stays Modules `product:font-awesome` |

### Captcha storage

Keep `captchaEnabled` / `captchaProvider` in `sf_site_chrome` for now (no DB migration). Site Chrome form no longer edits them; Security patches those fields via `updateSecurityCaptchaAction`. Runtime `resolveFormCaptcha` still reads Site Chrome JSON.

### PR #66 (form focus-only autosave)

Leave **alone** unless a one-line cherry-pick — dirty-tracking in `useAutosaveForm` + form-builder is a focused separate PR, not trivial to fold into this IA change.

## Admin nav

Site Settings becomes expandable (like Site Chrome / Forms):

- Modules (exact `/app/admin/settings`)
- Admin UX
- Auth & registration
- Security
- Performance

Font Awesome is a **Page settings** panel only (`#font-awesome` in-page anchor) — not a separate Layouts left-nav leaf (SF-121).

## Copy updates

Replace “Site Chrome captcha” / “use site captcha default (Site Chrome)” / “Site Settings → Integrations” with Site Settings → Security wording in Form particle UI and related hints.
