# Site Chrome plan

Site-wide chrome & policy (not per-page Page Settings, not feature Modules).

## Admin IA

- **Site Chrome** (new Core admin area) — fields below.
- **Modules** — on/off list (SF-42).
- **Nav** — leaves Site Settings → own **Nav manager** menu (SF-40).
- **Layouts → Page settings** — stays document chrome per page/global; outline assignment is on nav menu items.

## Site Chrome v1 fields

| Field | Notes |
|-------|--------|
| Site offline | toggle + optional message / allowlist IPs later |
| Site metadata | site name, default description, default OG image |
| Robots | default robots meta / robots.txt snippet |
| Content rights | copyright / rights statement |
| Cookie domain and path | session/cookie scope |

## Moved out

| Concern | Now lives |
| --- | --- |
| Default sitewide captcha (enable + provider) | [Site Settings → Integrations](./site-settings-topics-plan.md) (storage still `sf_site_chrome` for now) |
| Font Awesome | Layouts → Page settings / Font Awesome |

## Later

- Maintenance schedule, legal links, hreflang defaults.
- **Environment** child panel (gated `.env.local` overlay) — see [admin-env-editor-plan](./admin-env-editor-plan.md).
