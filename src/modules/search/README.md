# product:search + `search` particle (SF-132)

Public findability over **published** Payload pages — title, slug, meta title/description — via Payload/`contains` (Postgres ILIKE). No Algolia/Meilisearch.

| Layer | Role |
| --- | --- |
| Allowlist | `product:search` + `search` in `starforge.modules.json` |
| Manifests | `manifest.ts` (product) + `particle-manifest.ts` (particle) → `manifest-index.ts` |
| Site Settings → Modules | Runtime on/off for both ids |
| Route | `/search?q=` (404 when product off) |
| Particle | Layout palette `search` → GET form to `/search` |

## DB

Tags live in Payload (`tags` + `pages.tags` → `payload.pages_rels`). After pull, run `npm run db:migrate` so `20261103_181356_pages_tags_taxonomy` exists — otherwise published page loads fail joining `pages_rels`. Local push-era DBs: volume reset, then migrate + seed (see root README).

## Deferred

- Media library facets / tag filters on Media
- Public tag browse routes
- Full-text ranking / Postgres `tsvector`
- Particle cog editor (placeholder/button use defaults; M1 generic editor later)
