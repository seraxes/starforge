---
kind: history
last_verified: 2026-11-22
---
# product:pages — pack plan

**Status:** shipped. Phase 3b (2026-11-16) and phase 4 (shell and CMS packages, 2026-11-16) are done. The live map wins: [architecture-current](./architecture-current.md). Decision: [2026-11-15-payload-peel](./decisions/2026-11-15-payload-peel.md). Archive: [payload-dependency-map](../../archive/payload-dependency-map.md).

Media (phase 2) is done. `src/modules/pages` writes `sf_pages_*` only. There is no dual-write. `db:migrate` drops a leftover `payload` schema after the copy.

## Placement

`product:pages` under `src/modules/pages`. Not Core. Manifest `requires`: `product:rich-editor`, `product:media`.

## Owns

Editorial pages, drafts, version snapshots (last 20 per page), `/admin/pages`, page categories (one per page), page tags. Published slug, draft preview, search list, and sitemap summaries stay on `PageReadsPort` — the pages adapter is the only path when the pack is on. Pack off → empty reads. The admin page list Nav uses is not one of those four reads; Nav calls this pack’s public door.

## Consumes

`product:rich-editor` (TipTap body). `product:media` (`mediaId`, library picker). Core Nav (page bind on `sf_nav_menus`). Core locale host. Editor-typed copy follows the content-locale path.

## Parity

`/admin/pages` with draft and publish, TipTap, SEO, locales, version restore, `PageReadsPort`, and Nav page links. Payload `pages` (and page tags) are copied once into `sf_pages_*`. Public bodies are HTML.

## Out

Scheduled publish. A slug per locale. A collection builder. Live Preview iframe.

## After this track

The `/cms` shell and the CMS npm packages are off. `product:lexical-editor` stays an optional pack; its `@payloadcms/richtext-lexical` dependency stays while that pack imports it. Public page render does not import it.
