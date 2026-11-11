# product:redirects

Manifest-only contribution for Redirects (SF-141 M0).

- Catalog / nav views / ACL area metadata: `manifest.ts`
- CRUD, middleware lookup, CSV import, and `sf_redirects` still live under `src/core/redirects` until M3 (slice 6)
- Admin `/admin/redirects`: create/update/delete plus CSV import (`from,to,status,enabled,note`); matching `fromPath` upserts
- Proxy-chain wiring from the manifest is deferred to M2

## Locale policy (i18n P2)

Store **path-relative** rules without locale prefixes (`/old` → `/new`). One rule
covers `/en/old` and `/hu/old`. The proxy strips the request locale for lookup
and re-prefixes the relative destination with the **current request locale**.
Absolute `http(s)` destinations are unchanged. Do not build per-locale redirect trees.
