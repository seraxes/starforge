# product:redirects

Layer: site pack

Status: shipped

## Owns

URL redirects engine. Table `sf_redirects`. Proxy hook `handleRedirectProxy` (`proxy.ts`) — bare path match, locale strip/re-prefix, fail-open. Core reaches it through the generated proxy hook (`runProxyHooks`), not `@/core/redirects`. Admin CRUD + CSV import. Manifest: catalog, admin nav, `admin.routes`, `proxy` hook. Sitemap of published pages stays at `/sitemap.xml` (Core) — this module does not own that list.

**Locale policy:** store **path-relative** rules without locale prefixes (`/old` → `/new`). One rule covers `/en/old` and `/hu/old`. The proxy strips the request locale for lookup and re-prefixes the relative destination with the **current request locale**. Absolute `http(s)` destinations are unchanged. Do not build per-locale redirect trees.

CSV header `from,to,status,enabled,note`; invalid rows skipped; matching `fromPath` upserts.

## Consumes

None (`requires` / `optionalRequires` empty). Hosted by Core proxy / admin route shims.

## Public door

`@/modules/redirects/api` — `createRedirect`, `deleteRedirect`, `findRedirectByFromPath`, `findRedirectById`, `importRedirectsFromCsv`, `listRedirects`, `lookupEnabledRedirect`, `updateRedirect`, `normalizeRedirectFromPath`, `normalizeRedirectToPath`, `resolveLocaleAwareRedirectPath`, `resolveRedirectDestination`, `REDIRECT_STATUS_CODES`, `isRedirectStatusCode`. No `api.server`.

## Admin surfaces

- `/admin/redirects` — CRUD + CSV import (`admin/RedirectsPage.tsx` via route shim)
- ACL area: `redirects`

## Boot and jobs

None. Proxy hook runs per request when the pack is on (fail-open).

## Known gaps

- Does not own sitemap generation (`/sitemap.xml` = Core)

## Tests

`src/modules/redirects/paths.test.ts`, `src/modules/redirects/csv.test.ts`
