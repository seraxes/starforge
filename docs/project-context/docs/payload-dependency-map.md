# Payload dependency map

**Status:** phase 1 done (site settings on Core `sf_site_settings`, 2026-11-15). Phase **2a** media UX parity done (2026-11-15). Phase **2b** done (2026-11-15): the media document store is `sf_media_*`. `getPayload()` is gone from `src/core/media`. Phase **3a** and **3b** done (2026-11-16): `product:pages` is the editor, the PageReads source when the pack is on, and the home of migrated Payload pages. `/cms` stays until phase 4 for the Users bridge. Live map: [architecture-current](./architecture-current.md). Decision: [2026-11-15-payload-peel](./decisions/2026-11-15-payload-peel.md).

Payload 3.92.1 remains for the Users bridge and the `/cms` shell. Starforge pages are `public.sf_pages_*`. There is no dual-write. `Pages` and `Tags` are not registered. Leftover `payload.pages*` tables stay until phase 4. Media documents are `public.sf_media_*` (phase 2b). Postgres schema name for Payload is `payload` (`src/payload.config.ts`). This page names callers and the order they leave. Phase 1's table is `public.sf_site_settings`. Later phases do not get a module scaffold from this page.

Do not vendor or fork Payload source. Peel a bucket, then delete the npm packages that bucket was the last to import. `PageReadsPort` stays the swap boundary for the four layout-host reads. The full Payload stack is not a second CMS to keep. Media and site settings do not go back into Payload.

## getPayload buckets

| Bucket | What it is today | Leaves in |
| --- | --- | --- |
| **page-reads** | Four layout-host reads. Callers use `getPageReads()`. When `product:pages` is enabled, the door `createPagesPageReads()` serves them. Pack off → empty reads. The Payload adapter file is gone. | Phase **3b**. Do not add a second read API. |
| **media** | **Done (phase 2b).** Document store is `product:media` (`sf_media_assets`, `sf_media_categories`, `sf_media_tags`, `sf_media_asset_tags`). `getPayload()` is gone from `src/core/media`. Blobs are MediaStorage (`src/core/media/storage`), not `@payloadcms/storage-s3`. Derivatives are the sharp pipeline. Page tags are `sf_pages_tags`. Payload `tags` is not registered. Payload `media` / `categories` / `tags` tables may remain until phase 4. Pages OG stores a text `meta.mediaId`. | Phase **2b**. **2a** (edit panel, pagination, tag admin, non-image upload/browse, in-place replace) stays. |
| **settings** | **Done (phase 1).** Core singleton `public.sf_site_settings` (`0043_site_settings`). `getSiteSettings` / `updateSiteSettings` read and write that row and call `invalidateSiteSettings`. `seedEnableModulesDemo` uses the same writer. Legacy `primaryNav` is a jsonb read fallback copied once. The Payload global is not registered. Leftover `payload.site_settings` rows stay until phase 4. | Phase 1. Core `sf_site_settings`. Not a CMS. |
| **nav** | Menus already live in Core `sf_nav_menus`. `listNavPageOptions`, `ensureDefaultNavMenuSeeded`, and `seedMainNavFromPages` call the pages public door when the pack is on (generated `pages-api` loader — Core does not import the pack). Pack off → no page options. `db:migrate` rewrites stored numeric Payload `pageId`s to the Starforge uuid (`payload_legacy_id`). No dual-read. | Phase **3b**. Nav stays Core. The admin page-bind list is not one of the four port reads. |
| **cms-bridge** | Links a Better Auth user to a Payload `users` row so `/cms` does not ask for a second password. `getPayload()` in `src/core/cms-bridge/index.ts`, `payload-session.ts`, and `src/app/api/cms/exchange/route.ts`. Access helpers in `payload-access.ts` / `payload-strategy.ts` type Payload but are not `getPayload()` callers. | Phase 4, with the shell. |
| **(payload) shell** | Admin and HTTP surface. `src/app/(payload)/` (`/cms/admin`, REST, GraphQL). `src/payload.config.ts` registers `Users` only. `src/collections/` (`Users` registered; `Pages`, `Tags`, `Media`, and `Categories` files remain and are not registered), `src/migrations/`, `src/payload-types.ts`, `src/components/payload/`. Payload field UI for the old page body: `src/modules/rich-editor/payload/`. `src/globals/SiteSettings.ts` is a stub and is not in the globals list. | Phase 4. Pages parity bar is green. |

`src/seed.ts` `seedPages` writes through the pages pack door (phase 3b). `seedEnableModulesDemo` writes Core `sf_site_settings` (phase 1, done).

**Tags today:** media-tags are `sf_media_tags` (phase 2b). Page tags are `sf_pages_tags`. The Payload `tags` collection file remains and is not registered. Categories are media-only and live in `sf_media_categories`. Do not point Starforge media back at the Payload tags collection.

**Already off this map:** layout, search, and sitemap do not call `getPayload()` (they use the port). Site settings are `sf_site_settings`. Site Chrome is `sf_site_chrome`. Offline toggles must keep not calling `getPayload()`.

## npm packages

Pinned at **3.92.1** in `package.json`, plus one direct library that only the Payload routes use:

| Package | Used by | Delete when |
| --- | --- | --- |
| `payload` | Config, every `getPayload()` bucket, collections | Phase 4, after the last caller is gone |
| `@payloadcms/db-postgres` | Adapter in `payload.config.ts`; `src/migrations/` | Phase 4 |
| `@payloadcms/next` | `src/app/(payload)/` views and routes | Phase 4 |
| `@payloadcms/ui` | `src/modules/rich-editor/payload/SfHtmlField.tsx` (Payload admin field) | Phase 4 |
| `@payloadcms/storage-s3` | Not on the Starforge write path after phase 2b. Declared until phase 4 deletes it. MediaStorage uses `@aws-sdk/client-s3` when `STARFORGE_MEDIA_STORAGE=s3`. | Phase 4, if it is still declared. |
| `@payloadcms/richtext-lexical` | Payload-related imports in `product:lexical-editor` and `src/components/RichText` | Not the CMS peel. Lexical stays an optional editor pack. Do not delete this package while that pack still imports it. |
| `graphql` | No Starforge import. Payload GraphQL routes under `src/app/(payload)/api/graphql` | Phase 4, if nothing else needs it |

CLI scripts that boot Payload (`payload`, `generate:importmap`, `generate:types`, `payload:migrate`, `payload:migrate:create`) stay until phase 4.

## Peel order

Do not start phase 4 from a docs change. Do not combine tracks. Media before pages. `/cms` stays on until phase 4 (Users bridge). Media UX parity (2a), the document store (2b), and pages 3a–3b are done.

| Phase | Job | Stop when |
| --- | --- | --- |
| **0** | This map, the decision, the live map, the architecture rule, the media README. | Done when those docs match. No `src/modules/pages`. No package removal. No schema. |
| **1** | **Done.** Site settings (toggles, performance knobs, `primaryNavMenuId`) are Core `sf_site_settings`. Settings and `seedEnableModulesDemo` do not call `getPayload()`. | Media and pages still read and write Payload. Site Chrome stays put. |
| **2a** | **Done.** Media UX parity on the library: edit panel (alt, purpose, tags, private, category), pagination past 60, tag create/rename under `/admin/media`, non-image browse and admin upload (PDF / Word / plain text + images), in-place file replace through the sharp pipeline. | Store move is phase 2b. |
| **2b** | **Done.** `product:media` owns the document store (`sf_media_assets`, `sf_media_categories`, `sf_media_tags`, `sf_media_asset_tags`). Blobs are MediaStorage. Pages OG is a text media id. | Pages, nav page binds, and `/cms` still run on Payload. |
| **3a** | **Done.** `product:pages` MVP: `/admin/pages` draft and publish, TipTap, SEO, locales, page tags, `PageReadsPort` when the pack is on, Nav page list from the pack door. One-pager: [pages-pack-plan](./pages-pack-plan.md). | Shipped inside 3b. |
| **3b** | **Done (2026-11-16).** Version restore (last 20), migrate off Payload `pages`, `seedPages` uses the pages door, stored Nav id remap, Pages and Tags unregistered. | `/cms` still runs until phase 4. |
| **4** | cms-bridge, the `(payload)` shell, generated types, Payload migrations. Then delete the npm packages in the table above (Lexical’s package excepted). | No `getPayload()` left. Payload source was never vendored. |

## Parity bars

Phase 0 was docs only. The media UX bar and the pages bar below are implemented. Phase 4 (shell and npm packages) is open.

**Media UX (phase 2a) — done (2026-11-15),** on the existing library, before the store moves:

- [x] Edit panel (alt, purpose, multi-tags, private, category). Daily path is `/admin/media`. **ImageFrame** stays the display crop. No Payload focal editor.
- [x] Pagination past the first 60.
- [x] Tag create/rename under `/admin/media`.
- [x] Non-image browse and admin upload for the MIME types Forms already allow (PDF, Word, plain text, images). App admins see private and form items in the library.
- [x] In-place file replace. Derivatives regenerate through the existing sharp path.

**Media store (phase 2b) — done (2026-11-15).** `sf_media_*` is the document store. `getPayload()` is gone from `src/core/media`. Payload `media` and `categories` are not registered. Leftover `payload.media` / `payload.categories` tables stay until phase 4. Page tags are `sf_pages_tags`.

**Pages (phase 3b) — done (2026-11-16).** `/admin/pages` with draft and publish, TipTap body, SEO, locales, version restore, `PageReadsPort`, and Nav page links. Payload pages are copied into `sf_pages_*`. **Out:** scheduled publish, a per-locale slug, a collection builder, Live Preview iframe. `/cms` stays until phase 4.

`product:pages` `requires` `product:rich-editor` and `product:media`. It is not a Core screen and not a base engine other packs `require` for their own catalogs.
