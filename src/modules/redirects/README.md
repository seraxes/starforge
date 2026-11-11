# product:redirects

URL redirects (M3). The engine lives in this pack. Core reaches it through the generated proxy hook (`runProxyHooks`), not through `@/core/redirects`.

- Manifest: `manifest.ts` (catalog, admin nav, `admin.routes`, `proxy` hook)
- Table: `schema.ts` → `sf_redirects` (host Drizzle glob `src/modules/*/schema.ts`)
- Public door: `api.ts` (lookup route and other packs that are allowed to call this module)
- Proxy hook: `proxy.ts` `handleRedirectProxy` — same match rules as before (bare path, locale re-prefix, fail-open)
- Admin `/admin/redirects`: generated route shim → `admin/RedirectsPage.tsx` (CRUD + CSV import)
- CSV header `from,to,status,enabled,note`; invalid rows skipped; matching `fromPath` upserts
- Sitemap of published pages stays at `/sitemap.xml` (Core). This module does not own that list.

## Locale policy (i18n P2)

Store **path-relative** rules without locale prefixes (`/old` → `/new`). One rule
covers `/en/old` and `/hu/old`. The proxy hook strips the request locale for lookup
and re-prefixes the relative destination with the **current request locale**.
Absolute `http(s)` destinations are unchanged. Do not build per-locale redirect trees.
