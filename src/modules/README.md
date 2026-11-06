# Extension modules

Product packs hang off Starforge Core via **`defineStarforgeModule`** manifests (SF-141).
Core hosts extension points; packs contribute metadata + lazy import pointers. Codegen
writes `src/generated/module-registry.ts` — Core may import `@/generated/*` only, not
`@/modules/**` internals.

## Layout

```
src/modules/<id>/
  manifest.ts     # defineStarforgeModule({...}) — codegen reads this eagerly
  messages/       # optional <locale>.json UI chrome (i18n P3) — see MESSAGES.md
  …               # public/, admin/, server/, api.ts as the pack grows
```

**i18n:** Module UI strings register via `i18n.namespaces` + `messages/<locale>.json`.
Core merges enabled packs at request time. Contract for Events and later packs:
[`MESSAGES.md`](./MESSAGES.md).

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
| `product:forms` | `forms/manifest.ts` | Catalog + admin nav meta + Dashboard `forms.submissions` (live aggregates); engine still in `src/core/forms` (M4) |
| `product:rich-editor` | `rich-editor/` | Shared TipTap + sanitized HTML editor; engine in `src/core/rich-editor` |
| `product:lexical-editor` | `lexical-editor/` | Optional Lexical pack (legacy JSON / opt-in fields) |
| `form` | `form/` | Form particle (dynamic import when allowlisted) |
| `product:email-manager` | `email-manager/` | Rules/templates + send log + Dashboard `email.sent` |
| `product:events` | `events/` | Thin Dashboard `events.upcoming` stub (no schema yet) |
| `product:marketplace` | `marketplace/` | Thin Dashboard `marketplace.listings` stub (no schema yet) |
| `product:media` | `media/` | Library + Dashboard `media.counts` stub |
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

Place particles on the canvas at **`/admin/layouts`**. See `src/core/modules/README.md`.
