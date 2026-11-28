---
kind: reference
last_verified: 2026-11-28
---
# Production environment checklist

Sources: `.env.example`, `src/core/env/validate.ts`, `src/core/env-editor/catalog.ts`, `src/seed-production-guard.ts`, `src/modules/payments/credentials-crypto.ts`, `.github/workflows/ci.yml`.

Boot validation runs from `src/instrumentation.ts` via `assertStarforgeEnvAtBoot()`. In production, validation **errors throw** and prevent boot; **warnings** go to `console.warn` as `[starforge:env] …`.

Airsoft Nexus production turns Site Chrome “require email verification” on.

Placeholder detection (`isPlaceholderSecret`): exact match of `.env.example` secrets, or any value containing `dev-only` / `change-me` (case-insensitive). CI uses `ci-only-*` values that are not treated as those placeholders.

## Required in production (`validate.ts` errors when `NODE_ENV=production`)

| Key | What it does | Not-a-placeholder check |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | Non-empty. |
| `PAYLOAD_SECRET` | Payload signing secret (not a CMS login; not payment-credentials key) | Non-empty, ≥32 chars, not a placeholder secret. |
| `BETTER_AUTH_SECRET` | Better Auth signing secret; also signs the Environment unlock cookie | Non-empty, ≥32 chars, not a placeholder secret. |
| `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL` | Canonical app / Better Auth base URL | At least one set; must be `http(s)://…`. Production must be `https://` unless `STARFORGE_SECURE_COOKIES=0` (deliberate HTTP). |
| `SF_PAY_CREDENTIALS_KEY` | AES key material for merchant credential encryption (`credentials-crypto.ts`) | Required in production; must not be empty, must not equal `dev-only-payments-credentials-key`, must not look like a placeholder. No fallback to `PAYLOAD_SECRET` in production. (Not listed in `.env.example`; required by validate + crypto.) |

## Conditionally required

| Key | When | Check |
| --- | --- | --- |
| `REDIS_URL` | `STARFORGE_CONTENT_CACHE=redis` | Non-empty or production error / non-prod warn. Also used for Form rate-limit and Better Auth secondaryStorage when set (see `.env.example`). |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `STARFORGE_MEDIA_STORAGE=s3` | Each non-empty; incomplete s3 config errors at boot (no silent local fallback). |

## Recommended / optional (documented in env + catalog)

| Key | What it does | Production note |
| --- | --- | --- |
| `STARFORGE_SECURE_COOKIES` | `1` force Secure cookies + HSTS path; `0` force insecure; unset = derive from https URL / `NODE_ENV` | Leave unset on real HTTPS; set `0` only for deliberate HTTP. |
| `STARFORGE_TRUSTED_PROXY_HOPS` | Reverse-proxy hop count for `clientIp()` (`x-real-ip` or XFF at length−hops). Unset/0 = ignore proxy headers | Production **warns** when unset (shared rate-limit bucket). Usually `1` behind nginx / DO LB. Non-integer → warn. |
| `STARFORGE_TRUSTED_ORIGINS` | Extra comma-separated origins for Better Auth `trustedOrigins` + Payload CSRF | Optional; app URL origins always trusted. |
| `STARFORGE_DEVELOPER_ADMIN_EMAILS` | Emails allowed as developer-admins (Environment panel, script-capable Page Settings) | Production **warns** when empty — fail-closed (nobody). Locally empty = all app admins. |
| `STARFORGE_ADMIN_EMAILS` | Emails promoted to app admin (+ `cms_access`) on signup / seed / next request | Optional bootstrap. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth; both required to show Continue with Google | Leave both unset to hide the button. |
| `STARFORGE_CONTENT_CACHE` | `redis` or unset (Next tags) | Pair with `REDIS_URL` when `redis`. |
| `STARFORGE_REDIS_PREFIX` | Redis key prefix (default `sf:${NODE_ENV}`) | Lets staging + prod share one Redis. |
| `STARFORGE_MEDIA_STORAGE` | unset/`local` = disk under `/media`; `s3` = Spaces/S3 | Incomplete `s3` refuses boot. |
| `S3_REGION`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE`, `S3_ACL` | S3 extras (region, CDN base, path style, ACL) | Optional when s3 selected. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (site key public; secret server-only) | Warn if only one half is set. |
| `STARFORGE_MAIL_FROM` | Ops From override when Chrome From is empty | Optional. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | SMTP Mailer secrets | Warn when `SMTP_HOST` set but `SMTP_PORT` empty. Enable + provider under Site Chrome. |
| `RESEND_API_KEY` | Resend Mailer provider | Optional alternative to SMTP. |
| `STARFORGE_ENV_EDITOR` | `write` / `off` / `readonly`; unset = write only outside production | Prefer files/ops over a writable UI in production. |
| `STARFORGE_CSP_MODE` / `STARFORGE_CSP_REPORT_URI` | CSP enforce / report-only / off + optional report URI | Optional (`.env.example`). |
| `STARFORGE_MODULE_SOURCE` / `NODE_AUTH_TOKEN` / `SF_MODULES` | Module install source / registry token / allowlist override | Ops/build; not boot-hard errors in validate. |
| `STARFORGE_ADMIN_THEME` | Admin theme id (default `starforge-gantry`) | Optional. |
| `STARFORGE_ALLOW_PRODUCTION_SEED` | Override for `npm run seed` when `NODE_ENV=production` | Must be exactly `1` to allow seed; otherwise seed throws. **Local/demo only** per guard message — not a normal production setting. |
| Payments gateway / fiscal keys (`SF_PAYMENTS_PROVIDER`, `BARION_*`, `STRIPE_*`, `PAYPAL_*`, `SF_FISCAL_PROVIDER`, `NAV_*`) | Site-wide payment/fiscal secrets in env catalog | Enable methods in Payments admin; merchant POS keys stay in encrypted `sf_pay_merchant_credentials`. |

## Production rules already coded

### `validateStarforgeEnv` / `assertStarforgeEnvAtBoot`

- Production: missing/short/placeholder core secrets → **error** (boot throw).
- Production HTTPS: app URL must be `https://` unless `STARFORGE_SECURE_COOKIES=0`.
- Production: `SF_PAY_CREDENTIALS_KEY` required and non-placeholder.
- Production warn: empty `STARFORGE_TRUSTED_PROXY_HOPS`, empty `STARFORGE_DEVELOPER_ADMIN_EMAILS`.
- `STARFORGE_CONTENT_CACHE=redis` without `REDIS_URL` → production error.
- `STARFORGE_MEDIA_STORAGE=s3` missing any of the four S3 keys → error (any env).
- Turnstile / SMTP half-config → warnings.

### Seed guard (`assertSeedAllowed`)

- When `NODE_ENV=production`, `npm run seed` throws unless `STARFORGE_ALLOW_PRODUCTION_SEED=1`.
- Unset / development / test / other `NODE_ENV` is allowed (CI smoke uses seed without the override).

### Payments credentials crypto

- Production: dedicated `SF_PAY_CREDENTIALS_KEY` only; throws if missing at encrypt/decrypt time.
- Development may fall back to `PAYLOAD_SECRET`, then `dev-only-payments-credentials-key`.

## Email DNS (SPF / DKIM / DMARC)

TODO(owner): SPF, DKIM, and DMARC setup steps for the production From domain. The repo does not document those DNS records.
