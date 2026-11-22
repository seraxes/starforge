---
kind: history
last_verified: 2026-11-22
---
# Payload dependency map

**Status:** archive. Phases **0–4 done** (phase 4 on 2026-11-16). The content manager is `product:pages`. Media documents are `sf_media_*`. Site settings are Core `sf_site_settings`. There is no `getPayload()` and no `/cms` admin. Live map: [architecture-current](./architecture-current.md). Decision: [2026-11-15-payload-peel](./decisions/2026-11-15-payload-peel.md).

`/cms` and `/cms/*` redirect to `/admin`. CMS rights are Better Auth plus `sf_users.cms_access`. Draft preview uses that flag. `npm run db:migrate` copies any leftover `payload` schema into `sf_*` (idempotent), then runs `0048_drop_payload_schema.sql` (`DROP SCHEMA IF EXISTS payload CASCADE`). That drop is not in the Drizzle journal, so it cannot run before the copy. A database that never runs `db:migrate` can still hold an orphan `payload` schema until a DBA drops it.

Do not vendor a CMS. Do not put media or site settings back into one.

## Buckets

| Bucket | Where it lives now | Left in |
| --- | --- | --- |
| **page-reads** | `getPageReads()` → `product:pages` when the pack is on, else empty | Phase 3b |
| **media** | `product:media` (`sf_media_*`). Blobs are MediaStorage. | Phase 2b |
| **settings** | Core `sf_site_settings` | Phase 1 |
| **nav** | Core `sf_nav_menus`. Page options come from the pages door. | Phase 3b |
| **cms-bridge** | `sf_users.cms_access` only. No user stub, no JWT exchange, no `/api/cms/exchange`. | Phase 4 |
| **shell** | Removed: `(payload)` routes, config, collections, globals, generated types, Payload migrations, Payload admin nav. | Phase 4 |

## npm packages

| Package | Status |
| --- | --- |
| `payload` | Removed in phase 4 |
| `@payloadcms/db-postgres` | Removed in phase 4 |
| `@payloadcms/next` | Removed in phase 4 |
| `@payloadcms/ui` | Removed in phase 4 |
| `@payloadcms/storage-s3` | Removed in phase 4. MediaStorage uses `@aws-sdk/client-s3` when `STARFORGE_MEDIA_STORAGE=s3`. |
| `graphql` | Removed in phase 4. Nothing in Starforge imported it. |
| `@payloadcms/richtext-lexical` | **Kept.** `product:lexical-editor` still imports it. Do not delete it while that pack exists. |

## Peel order

| Phase | Job | Stop when |
| --- | --- | --- |
| **0** | This map, the decision, the live map, the architecture rule. | Done. Docs only. |
| **1** | Site settings on `sf_site_settings`. | Done. |
| **2a** | Media UX parity on `/admin/media`. | Done. |
| **2b** | Media document store on `sf_media_*`. | Done. |
| **3a** | `product:pages` daily edit. | Done. |
| **3b** | Version restore, page migrate, Nav id remap. | Done (2026-11-16). |
| **4** | CMS bridge, `/cms` shell, CMS npm packages. | **Done (2026-11-16).** No `getPayload()`. |

## Parity bars

**Media UX (phase 2a) — done.** Edit panel, pagination, tags, non-image upload, in-place replace. ImageFrame stays the display crop.

**Media store (phase 2b) — done.** `sf_media_*` is the document store.

**Pages (phase 3b) — done.** `/admin/pages` with draft and publish, TipTap, SEO, locales, version restore, `PageReadsPort`, and Nav page links. **Out:** scheduled publish, a per-locale slug, a collection builder, Live Preview iframe.

`product:pages` `requires` `product:rich-editor` and `product:media`. It is not a Core screen and not a base engine other packs `require` for their own catalogs.
