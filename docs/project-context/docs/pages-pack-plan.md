# product:pages — pack plan

**Status:** phase 3b done (2026-11-16). Daily edit (3a) and the Payload pages cutover (version restore, Lexical/HTML migrate, Payload pages unregistered, stored Nav id remap) are in. Phase 4 (`/cms` shell, Payload npm packages) is still open. The live map wins: [architecture-current](./architecture-current.md). Decision: [2026-11-15-payload-peel](./decisions/2026-11-15-payload-peel.md). Buckets and order: [payload-dependency-map](./payload-dependency-map.md).

Media (phase 2) is done. `src/modules/pages` writes `sf_pages_*` only. Payload `pages` and `tags` are not registered. Leftover `payload.pages*` tables stay until phase 4. There is no dual-write and no `getPayload()` on the page, nav, or seed page path.

## Placement

`product:pages` under `src/modules/pages`. Not Core. Manifest `requires`: `product:rich-editor`, `product:media`.

## Owns

Editorial pages, drafts, version snapshots (last 20 per page), `/admin/pages`, page tags. Published slug, draft preview, search list, and sitemap summaries stay on `PageReadsPort` — the pages adapter is the only path when the pack is on. Pack off → empty reads. The admin page list Nav uses is not one of those four reads; Nav calls this pack’s public door.

## Consumes

`product:rich-editor` (TipTap body). `product:media` (`mediaId`, library picker). Core Nav (page bind on `sf_nav_menus`). Core locale host. Editor-typed copy follows the content-locale path.

## Parity

`/admin/pages` with draft and publish, TipTap, SEO, locales, version restore, `PageReadsPort`, and Nav page links. Payload `pages` (and page tags) are copied once into `sf_pages_*`. Public bodies are HTML.

## Out

Scheduled publish. A slug per locale. A collection builder. Live Preview iframe. Phase 4 shell deletion.

## After this track

`/cms` and the Payload npm packages come off in peel phase 4. `product:lexical-editor` stays an optional pack; its `@payloadcms/richtext-lexical` dependency is not removed by this plan. Public page render does not import it.
