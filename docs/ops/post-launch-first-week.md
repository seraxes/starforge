---
kind: reference
last_verified: 2026-11-22
---
# Post-launch — first week signals

Signals the app already logs or returns. Who responds: TODO(owner).

## Health

| Signal | Where |
| --- | --- |
| `GET /api/health` → `ok: true` / `database: up` | `src/app/api/health/route.ts` — `200` JSON |
| `ok: false` / `database: down` + `error` | Same route — `503` |
| Dashboard System health glance | `system.health` — DB probe, Redis probe (when selected), media ready, migration count vs journal (`src/core/dashboard/widgets/system-health-stats.ts`) |
| Attention: `health.fail` / `health.warn` | Dashboard needs-attention rail (`attention.ts`) |

## Environment warnings / boot

| Signal | Where |
| --- | --- |
| `[starforge:env] <key>: <message>` | `console.warn` from `assertStarforgeEnvAtBoot` (warnings always; errors as warn in non-prod) |
| Production boot throw | `Starforge environment validation failed:…` when validate errors and `NODE_ENV=production` |
| Attention `env.<KEY>` rows | Developer-admin only; from `validateStarforgeEnv().warnings` (capped; secretish messages stripped) |
| Attention `site.offline` | Site Chrome offline flag |
| Attention `mailer.off` | Outbound email disabled in Site Chrome |

## Mail errors

| Signal | Where |
| --- | --- |
| `MailSendResult.ok === false` + optional `error` / `skipped` | Core Mailer send result (`src/core/mail/types.ts`) |
| Durable send log | `sf_email_sends` — `status` `sent` \| `failed` \| `skipped`; `error` column on failure (`src/modules/email-manager/schema.ts`) |
| Admin list | Email Manager Sends UI (`/admin/email` sends list) shows failed rows + error text |
| Soft log wrapper | `withEmailSendLog` records every send attempt when Email Manager door is present |

## Who responds

TODO(owner): on-call / owner for health failures, env warnings, and mail failures in the first week.
