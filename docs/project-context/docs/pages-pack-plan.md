# product:pages — pack plan

**Status:** not started. Phase 3 of the Payload peel. The live map wins: [architecture-current](./architecture-current.md). Decision: [2026-11-15-payload-peel](./decisions/2026-11-15-payload-peel.md). Buckets and order: [payload-dependency-map](./payload-dependency-map.md).

Do not add `src/modules/pages` until that phase is the job. Media peels first (phase 2).

## Placement

`product:pages` under `src/modules/pages`. Not Core. Manifest `requires`: `product:rich-editor`, `product:media`.

## Owns

Editorial pages, drafts, `/admin/pages`, page tags. Published slug, draft preview, search list, and sitemap summaries stay on `PageReadsPort` — swap the adapter, do not add a second read API. The admin page list Nav uses today is not one of those four reads; phase 3 gives Nav a non-Payload source from this pack.

## Consumes

`product:rich-editor` (TipTap body). `product:media` (`mediaId`, library picker). Core Nav (page bind on `sf_nav_menus`). Core locale host. Editor-typed copy follows the content-locale path when that is how sibling fields work.

## Parity, then migration

`/admin/pages` with draft and publish, TipTap, SEO, locales, `PageReadsPort`, and Nav page links. After that bar: version restore, then migrate off Payload `pages` (and the page side of the shared `tags` collection).

## Out

Scheduled publish. A slug per locale. A collection builder.

## After this track

`/cms` and the Payload npm packages come off in peel phase 4, and only after this bar and the media bar are both green. `product:lexical-editor` stays an optional pack; its `@payloadcms/richtext-lexical` dependency is not removed by this plan.
