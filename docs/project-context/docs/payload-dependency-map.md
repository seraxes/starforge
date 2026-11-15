# Payload dependency map

**Status:** phase 1 done (site settings on Core `sf_site_settings`, 2026-11-15). Live map: [architecture-current](./architecture-current.md). Decision: [2026-11-15-payload-peel](./decisions/2026-11-15-payload-peel.md).

Payload 3.92.1 is still the running store for media and pages. Postgres schema name is `payload` (`src/payload.config.ts`). This page names callers and the order they leave. Phase 1's table is `public.sf_site_settings`. Later phases do not get a module scaffold from this page.

Do not vendor or fork Payload source. Peel a bucket, then delete the npm packages that bucket was the last to import. `PageReadsPort` stays the swap boundary for the four layout-host reads. The full Payload stack is not a second CMS to keep. Media and site settings do not go back into Payload.

## getPayload buckets

| Bucket | What it is today | Leaves in |
| --- | --- | --- |
| **page-reads** | Four layout-host reads. Sole `getPayload()` home: `src/core/content/page-reads/payload.ts` (`pages`). Callers use `getPageReads()` — `src/core/content/page-reads/index.ts`, `sitemap.ts`, `search.ts`. | Phase 3. Swap the adapter to `product:pages`. Do not add a second read API. |
| **media** | Document store behind the Starforge library. `getPayload()` in `src/core/media/ingest.ts`, `actions.ts`, `resolve.ts`, `category-store.ts`, `form-upload.ts`. Collections: `media`, `categories`. Blob I/O for S3 is the Payload plugin `src/core/media/storage/payload-plugin.ts` (`@payloadcms/storage-s3`), not a `getPayload()` call. Local disk is Payload `staticDir`. | Phase 2, after the media parity bar. Owner: `product:media`. Blobs stay MediaStorage. |
| **settings** | **Done (phase 1).** Core singleton `public.sf_site_settings` (`0043_site_settings`). `getSiteSettings` / `updateSiteSettings` read and write that row and call `invalidateSiteSettings`. `seedEnableModulesDemo` uses the same writer. Legacy `primaryNav` is a jsonb read fallback copied once. The Payload global is not registered. Leftover `payload.site_settings` rows stay until phase 4. | Phase 1. Core `sf_site_settings`. Not a CMS. |
| **nav** | Menus already live in Core `sf_nav_menus`. Remaining `getPayload()` in `src/core/nav/store.ts` reads the `pages` collection: `listNavPageOptions`, `ensureDefaultNavMenuSeeded`, `seedMainNavFromPages`. | Phase 3, with pages. Nav stays Core. The admin page-bind list is not one of the four port reads. |
| **cms-bridge** | Links a Better Auth user to a Payload `users` row so `/cms` does not ask for a second password. `getPayload()` in `src/core/cms-bridge/index.ts`, `payload-session.ts`, and `src/app/api/cms/exchange/route.ts`. Access helpers in `payload-access.ts` / `payload-strategy.ts` type Payload but are not `getPayload()` callers. | Phase 4, with the shell. |
| **(payload) shell** | Admin and HTTP surface. `src/app/(payload)/` (`/cms/admin`, REST, GraphQL). `src/payload.config.ts`, `src/collections/` (`Users`, `Media`, `Pages`, `Tags`, `Categories`), `src/migrations/`, `src/payload-types.ts`, `src/components/payload/`. Payload field UI for the page body: `src/modules/rich-editor/payload/`. `src/globals/SiteSettings.ts` is a stub and is not in the globals list. | Phase 4, after both parity bars are green. |

`src/seed.ts` `seedPages` writes the `pages` collection (phase 3). `seedEnableModulesDemo` writes Core `sf_site_settings` (phase 1, done).

**Tags today:** one Payload `tags` collection is shared by pages and media (`src/collections/Tags.ts`). Accepted split: media-tags go with `product:media` (phase 2); page tags go with `product:pages` (phase 3). Categories are media-only. Do not keep that shared Payload collection as the long-term store.

**Already off this map:** layout, search, and sitemap do not call `getPayload()` (they use the port). Site settings are `sf_site_settings`. Site Chrome is `sf_site_chrome`. Offline toggles must keep not calling `getPayload()`.

## npm packages

Pinned at **3.92.1** in `package.json`, plus one direct library that only the Payload routes use:

| Package | Used by | Delete when |
| --- | --- | --- |
| `payload` | Config, every `getPayload()` bucket, collections | Phase 4, after the last caller is gone |
| `@payloadcms/db-postgres` | Adapter in `payload.config.ts`; `src/migrations/` | Phase 4 |
| `@payloadcms/next` | `src/app/(payload)/` views and routes | Phase 4 |
| `@payloadcms/ui` | `src/modules/rich-editor/payload/SfHtmlField.tsx` (Payload admin field) | Phase 4 |
| `@payloadcms/storage-s3` | `src/core/media/storage/payload-plugin.ts` when `STARFORGE_MEDIA_STORAGE=s3` | Phase 2 stops calling it. Remove the dependency in phase 4 if it is still declared. MediaStorage stays the blob port. |
| `@payloadcms/richtext-lexical` | Payload-related imports in `product:lexical-editor` and `src/components/RichText` | Not the CMS peel. Lexical stays an optional editor pack. Do not delete this package while that pack still imports it. |
| `graphql` | No Starforge import. Payload GraphQL routes under `src/app/(payload)/api/graphql` | Phase 4, if nothing else needs it |

CLI scripts that boot Payload (`payload`, `generate:importmap`, `generate:types`, `payload:migrate`, `payload:migrate:create`) stay until phase 4.

## Peel order

Do not start 1–4 from a docs change. Do not combine tracks. Media before pages. `/cms` stays on until both parity bars below are green.

| Phase | Job | Stop when |
| --- | --- | --- |
| **0** | This map, the decision, the live map, the architecture rule, the media README. | Done when those docs match. No `src/modules/pages`. No package removal. No schema. |
| **1** | **Done.** Site settings (toggles, performance knobs, `primaryNavMenuId`) are Core `sf_site_settings`. Settings and `seedEnableModulesDemo` do not call `getPayload()`. | Media and pages still read and write Payload. Site Chrome stays put. |
| **2** | Media parity bar, then `product:media` takes the document store (`media`, `categories`, media-tags). | Pages, nav page binds, and `/cms` still run on Payload. |
| **3** | `product:pages` parity bar, then version restore and migration off Payload `pages`. Swap the `PageReadsPort` adapter. Nav page finds and `seedPages` stop calling `getPayload()`. Page tags move here. One-pager: [pages-pack-plan](./pages-pack-plan.md). | `/cms` still runs until phase 4. |
| **4** | cms-bridge, the `(payload)` shell, generated types, Payload migrations. Then delete the npm packages in the table above (Lexical’s package excepted). | No `getPayload()` left. Payload source was never vendored. |

## Parity bars

Document only. Do not build them in phase 0.

**Media (phase 2), on the existing library, before the store moves:** edit drawer, pagination, tag admin, non-image files, file replace. Then the pack’s own document store. **ImageFrame** stays the display crop (`product:media` picker / frame editor). Do not replace it with Payload focal point.

**Pages (phase 3):** `/admin/pages` with draft and publish, TipTap body, SEO, locales, `PageReadsPort`, and Nav page links. Then version restore and the migration off Payload. **Out:** scheduled publish, a per-locale slug, a collection builder.

`product:pages` `requires` `product:rich-editor` and `product:media`. It is not a Core screen and not a base engine other packs `require` for their own catalogs.
