# Starforge project context

**Live map:** [architecture-current](./architecture-current.md). Where this file still says Payload owns media, or that Core is the whole CMS, the live map wins. Payload is the first optional content-manager pack. The media library and site settings stay Starforge’s.

## Purpose

Starforge is a reusable **product core / starter platform** for Zoltan’s ordinary web projects: marketing sites, brochure apps, and typical web apps that are not highly specialized (not games, not exotic one-offs).

When a new project is “something that already exists in the world” (CMS-backed site, membership app, content + accounts), Starforge is the starting point so auth, user management, content management, media, and nearby plumbing are not rebuilt each time.

Inspiration: the breadth of systems like Joomla (flexible CMS + extensions), but **owned and extendable on Zoltan’s terms** — not locked into a rigid CMS product shape.

**ASN 2.0** = **Airsoftnexus 2.0** — a later product built *on* Starforge. Starforge itself is built **first as the core CMS / starter platform**; ASN 2.0 feature work waits until that core is solid enough locally. ASN domain modules (and Joomla 5 user-hash migration) live in the ASN app layer — they must not pollute generic Starforge core files.

## Build priority (locked)

1. **Starforge core CMS** — auth/users (core), content/media (Payload), admin, local env, extension points  
2. Then grow toward ASN 2.0-shaped features on that core  
3. DigitalOcean only after substantial local capability

## Non-goals

- Not optimized for unusual or highly specialized products (e.g. games).
- Not “Payload with a skin” as the whole architecture.
- Not a hosted SaaS CMS replacement for Sanity/Contentful unless that emerges later.

## Constraints (locked)

- **Architectural freedom:** core owns product APIs, auth, users, and extension points. Payload is the first optional content-manager pack (pages, drafts, versions). The media library is a Starforge module. Another content manager can replace Payload later behind the same page read API. Do not build that second pack until one is chosen.
- **Performance / scale:** target ordinary web apps at roughly **tens of thousands of users** — “lightning fast” on hot paths. Do not put high-QPS user traffic through Payload admin or Local API as the app’s primary runtime.
- **Extendability:** new project features hang off Starforge core hooks/modules, not Payload plugin sprawl.

## Architecture (locked)

- **Starforge core:** tenancy (if needed), auth/sessions, user/admin management, app shell, extension points, public/product APIs, jobs, audit, config. Prefer Next.js (or Hono beside it) + Drizzle + PostgreSQL for core tables.
- **Payload CMS 3 (content module):** collections, editorial workflow, media library, versions/drafts. Same Postgres (separate schema recommended) or dedicated DB. Editors use Payload admin; apps read published content via cached queries / core BFF, not raw Payload on every page hit.
- **Stack baseline:** React via Next.js, Node, PostgreSQL.

## Scalability notes

- ~10k concurrent-capable users is routine for Node + Postgres when auth/session and reads are designed correctly (connection pooling, indexes, CDN/static where possible, cache published content).
- Payload is fine as CMS; risk is using it as the app server for every request. Keep hot paths in core.
- Scale levers later: Redis (sessions/cache/queues), read replicas, object storage for media, edge/CDN for public pages.

## Decision

**Use Payload** as the content/media module. Do not use Payload as the whole product core.

## Hosting (planned — later)

Target when ready for live/staging servers (not now):

- **Provider:** DigitalOcean
- **OS:** Debian on AMD droplets
- **Topology:** two droplets, each **4 vCPU / 8 GB RAM**
  - **Web:** Next.js/Node app + Payload admin + reverse proxy (Caddy or Nginx); Redis later on this box or adjacent
  - **Database:** PostgreSQL only
- **Network:** private VPC between web ↔ DB; Postgres not exposed publicly
- **Ops baseline:** TLS on web, UFW/fail2ban, automated DB backups (or Spaces), droplet snapshots, PgBouncer when connections grow
- **Outgrow path:** DO Managed Postgres, object storage for media, second web node + load balancer, dedicated Redis

## Delivery order (locked)

1. **SF-4:** Scaffold Starforge core + Payload content module
2. **Local:** Build and test on a local environment (Docker Compose or native Node + Postgres)
3. Reach feature parity with most of **Airsoftnexus 2.0 (ASN 2.0)** functions
4. Only then provision/test on DigitalOcean live servers — no live-server work before that
