---
kind: reference
last_verified: 2026-11-22
---
# Cutover checklist

First production site: **Airsoft Nexus** ([launch scope](../project-context/docs/decisions/2026-11-22-launch-scope.md)). **InspecTra** may ship earlier while Core polish continues.

Dates, DNS TTL, and how long the old site stays read-only: TODO(owner).

## Checklist (headings only)

### Pre-cutover

- [ ] Production env filled per [production-env-checklist](./production-env-checklist.md)
- [ ] Migrations applied (`npm run db:migrate`) and [deploy](./deploy.md) build/start verified
- [ ] `GET /api/health` returns `ok: true`
- [ ] [Backup](./backup-restore.md) taken (schedule/target = TODO(owner))
- [ ] User / avatar / profile / upcoming-event / ratings migration per [migration-users-events](./migration-users-events.md)
- [ ] Redirects CSV imported per [redirects-and-archive](./redirects-and-archive.md)
- [ ] Airsoft Nexus module enablement (every built pack; Lexical optional)
- [ ] Mailer / Turnstile / payments credentials smoke (non-placeholder secrets)

### DNS / traffic

- [ ] TODO(owner): DNS cutover date and TTL
- [ ] TODO(owner): old site read-only window length
- [ ] Health check after DNS points at Starforge

### Post-cutover

- [ ] First-week signals per [post-launch-first-week](./post-launch-first-week.md)
- [ ] Confirm past events and non-migrated content remain on the old archive (TODO(owner): location)
