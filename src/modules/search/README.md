# product:search

Layer: site pack

Status: shipped

## Owns

Public findability over **published** pages — title, slug, meta title/description — via Postgres ILIKE (no Algolia/Meilisearch). Public route `/search?q=` (404 when product off). Companion layout particle `search` (`particle-manifest.ts` → `searchModule`) — GET form to `/search`. Allowlist: `product:search` (+ particle id `search`) in `starforge.modules.json`. No pack `sf_*` tables; reads published page data through the pages / PageReads path. Runtime on/off under Site Settings → Modules.

## Consumes

None in `requires` / `optionalRequires`. Searches published page content (post–Payload peel: pages live in `product:pages` / `PageReadsPort`, not Payload).

## Public door

none (route + particle are manifest-driven; no `@/modules/search/api`)

## Admin surfaces

None. ACL area: none declared.

## Boot and jobs

None. When on, `/search` and the `search` particle are available.

## Known gaps

- Public tag browse routes
- Full-text ranking / Postgres `tsvector`
- Particle cog editor (placeholder/button use defaults; generic editor later)
- Older notes about Payload `tags` / `pages_rels` are historical; brochure pages are `product:pages`

## Tests

None registered in `test:unit` for this pack. Related verify script: `verify:search-query`.
