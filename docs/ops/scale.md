---
kind: reference
last_verified: 2026-11-28
---
# Scale

When to stay on one process, and what must be shared before a second copy of this app.

Sources: `src/core/jobs/index.ts`, `src/core/content/cache/index.ts`, `src/core/security/rate-limit/index.ts`, `src/core/auth/index.ts`, `src/core/realtime/index.ts`, `src/core/media/storage/index.ts`. Live map: [architecture-current](../project-context/docs/architecture-current.md). Host, proxy, and process manager are still open in [deploy](./deploy.md).

A copy is another `next start` of the same build, with the same env and the same Postgres. A reverse proxy spreads requests. Any copy can serve any URL. Packs stay inside that process: posts, comments, chat, and the media catalog are not separate servers. File bytes move to object storage when a second machine needs them.

## One process

Launch shape. One `npm run start`. Postgres on a private network. This is the right size while one machine keeps up with page latency and holds the media files.

## Before a second process

Set `REDIS_URL`. Then set the switches that do not follow it on their own.

| Concern | Shared today | Before a second process |
| --- | --- | --- |
| Sessions | Postgres (`storeSessionInDatabase`) | Already shared. `REDIS_URL` also mirrors lookups and moves Better Auth's rate limit onto Redis. |
| Published content cache | Next tags, per process | `STARFORGE_CONTENT_CACHE=redis` (requires `REDIS_URL`). Otherwise a save on one process leaves the other serving stale pages. |
| Rate limits | Redis when `REDIS_URL` is set; otherwise memory | `REDIS_URL`, or each process keeps its own buckets. |
| Realtime | Memory bus | `STARFORGE_REALTIME_FANOUT=redis` and `REDIS_URL`. Otherwise a publish on one process never reaches subscribers on another. |
| JobRunner | Memory only. `REDIS_URL` does not switch it | Stay on one process. Idempotency keys do not cross processes. Broadcast drains, expiry sweeps, and reminders arm on every process. |

`STARFORGE_TRUSTED_PROXY_HOPS` is usually `1` behind a single proxy. See [production-env-checklist](./production-env-checklist.md).

## Before a second machine

Same Redis switches as a second process, plus `STARFORGE_MEDIA_STORAGE=s3` and the required `S3_*` keys. Local disk files exist only on the machine that wrote them. Two processes on one machine can keep local disk if they share that directory.

Postgres stays one primary, private, not reachable from the public internet. When the copies' connection count is the limit, put a pooler in front of that primary.

## After JobRunner can be shared

A Redis-backed JobRunner is the gate for a second `next start`. It is not in the tree. Product code already calls `enqueue()`; the adapter plugs in behind that door. Do not add a second queue framework for that step.

After that adapter exists, more web copies are the normal step. A process that only drains jobs comes later, and only if that work delays page responses. A process that only holds realtime connections comes later, and only if those connections crowd page latency. Redis fanout comes first. A different runtime (the Scan reader, when that pack exists) is its own process. Product packs stay in the web copies.

## Health

`GET /api/health` reports the database. The dashboard System health glance also probes Redis when it is selected, plus media readiness. See [post-launch-first-week](./post-launch-first-week.md).
