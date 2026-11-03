# Extension modules

Product packs hang off Starforge Core via **`defineStarforgeModule`** manifests (SF-141).
Core hosts extension points; packs contribute metadata + lazy import pointers. Codegen
writes `src/generated/module-registry.ts` — Core may import `@/generated/*` only, not
`@/modules/**` internals.

## Layout

```
src/modules/<id>/
  manifest.ts     # defineStarforgeModule({...}) — codegen reads this eagerly
  …               # public/, admin/, server/, api.ts as the pack grows
```

Core-owned platform / builtin particle / atom rows live in
`src/core/modules/host-manifests.ts`. Packs are aggregated in `manifest-index.ts`.

## Allowlist (install / build)

Edit [`starforge.modules.json`](../../starforge.modules.json), then:

```bash
npm run modules:generate
```

| Layer | Role |
| --- | --- |
| Allowlist | Which packs are installed in this build (no deadweight) |
| Site Settings → Modules | On/off for installed packs (derived catalog) |

Override allowlist for one run: `SF_MODULES=platform:better-auth,page-content,... npm run modules:generate`.

## Packs in this tree

| Id | Path | Notes |
| --- | --- | --- |
| `product:forms` | `forms/manifest.ts` | Catalog + admin nav meta; engine still in `src/core/forms` (M4) |
| `form` | `form/` | Form particle (dynamic import when allowlisted) |
| `product:consent` | `consent/` | Banner + `publicShell` bodyEnd via generated loaders |
| `product:redirects` | `redirects/manifest.ts` | Catalog + admin meta; engine still in `src/core/redirects` (M3) |
| `notice-bar` | `notice-bar/` | Example extension particle |
| `product:search` / `search` | `search/` | Public `/search` + layout particle |

## Particles (builtin + optional)

| Particle | Id | Notes |
| --- | --- | --- |
| Notice bar | `notice-bar` | Extension — allowlist + Modules toggle |
| Form | `form` | Needs allowlisted `product:forms` + `form` |
| Search | `search` | Public search box → `/search` — needs allowlisted `product:search` + `search` |
| Page Content | `page-content` | Built-in (core, required) |
| Site Header | `site-header` | Built-in (core) |
| Logo / Image | `logo` | Built-in |
| Menu | `menu` | Built-in |
| Copyright | `copyright` | Built-in |
| Social | `social` | Built-in |
| Custom | `custom` | Built-in escape hatch |
| Login / Welcome | `login` | Built-in |

Place particles on the canvas at **`/app/admin/layouts`**. See `src/core/modules/README.md`.
