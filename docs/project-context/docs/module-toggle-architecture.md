# Module toggles without deadweight

## Goal

Site Settings shows every **product module** (notice bar, marketplace later, FA, layout particles packs, etc.) with on/off. Building a lean corporate QA site must not ship ASN marketplace/chat/etc. as deadweight.

## Two layers (both needed)

### 1. Runtime feature flags (already the direction)

- Core table / site settings: `modules.{id}.enabled` (`site-settings.moduleToggles[]`).
- Admin: **Site Settings → Modules** — list name, description, status toggle.
- Palette, nav, public render, Page Settings atoms: **skip disabled** modules.
- Good for: temporary off, A/B, per-tenant without rebuild.

Runtime alone does **not** remove code from the JS bundle.

### 2. Install / compile-time packages (no deadweight)

Industry pattern: **optional workspace packages** (or Next.js `experimental.optimizePackageImports` + dynamic `import()` only when enabled — still leaves code on disk).

Stronger Starforge approach:

| Mechanism | Effect |
|-----------|--------|
| **Monorepo packages** `@starforge/module-*` | Module lives in its own package; app only depends on what you install |
| **`starforge.modules.json` / env `SF_MODULES=notice,layout-core`** | Build reads allowlist; codegen writes `src/generated/module-registry.ts` that only imports enabled packages |
| **Docker/image flavors** | `Dockerfile.core` vs `Dockerfile.asn` install different package sets |
| **CI matrix** | `core` build fails if ASN package imported |

Disabled at install time → not in `node_modules` / not in bundle → no deadweight.

## Recommended Starforge model

1. **Catalog** (code): every module declares `id`, `title`, `package`, `defaultEnabled`, `requires[]`.
2. **Site Settings → Modules**: toggles for *installed* modules only (runtime).
3. **Project flavor** (build): `core` | `asn` | custom allowlist in `starforge.modules.json` — `npm run modules:sync` updates dependencies + regenerates registry.
4. Particles/atoms register via `registerModule()` called only from generated registry — Layout palette never sees uninstalled modules.
5. Feature toggle off → hide + no public render; uninstall → remove package + regenerate (stronger).

## P0 installed catalog (expand as modules ship)

| Kind | Id | Label | Notes |
| --- | --- | --- | --- |
| platform | `platform:better-auth` | Better Auth | **Required** |
| platform | `platform:payload-cms` | Payload CMS | Gates CMS nav / admin entry |
| product | `product:layout-manager` | Layout manager / Outlines | Admin Layout+Outlines; minimal public shell when off |
| product | `product:page-settings` | Page Settings | Admin + public chrome emit |
| product | `product:primary-nav` | Primary nav | Nav manager admin + public header links (site default menu from Site Settings) |
| product | `product:font-awesome` | Font Awesome | Public FA assets |
| product | `product:registration` | Registration | Syncs legacy `featureRegistration` |
| product | `product:rich-editor` | Rich editor | Syncs legacy `featureRichEditor` |
| product | `product:posts` | Posts | Placeholder |
| product | `product:draft-preview` | Draft preview | Syncs legacy `featureDraftPreview` |
| particle | `page-content`, `site-header`, `logo`, `copyright`, `social`, `custom`, `notice-bar`, … | From `registerModule` | `page-content` required |
| atom | `atom:analytics`, `atom:custom-css-js`, … | From `registerAtom` | Page Settings pills + inject |

## Phased delivery

- **P0:** Site Settings Modules UI lists the full installed product catalog (above) with on/off; gate nav/palette/public; required modules marked non-disableable.
- **P1:** Generated registry + dynamic import boundaries per module entry.
- **P2:** Split `@starforge/module-*` packages + `modules:sync` allowlist so unused packages are not installed in lean images.

## Private module registry (own server)

Yes. Core can pull only needed modules from **your** registry (not public npm):

- **Chosen registry: GitHub Packages** (npm scope under the Starforge/org repo).
- `starforge.modules.json` lists `id` + `@org/module-*` version; `modules:sync` installs via `.npmrc` → `npm.pkg.github.com`.
- Auth: `NODE_AUTH_TOKEN` / `GITHUB_TOKEN` in env (never in git). Same allowlist → no deadweight; ASN droplet pulls more packages than a lean QA droplet.
- Hot-download at runtime without rebuild is possible later but weaker for ACL/security — prefer sync-at-deploy for v1.

## Not recommended

- One mega-app with only CSS `display:none` / unused routes still bundled.
- Runtime toggle that still statically imports ASN at top of layout.

## Success criteria

- Lean site build: marketplace/chat packages absent from dependency tree and client bundles.
- ASN flavor: same Core + extra packages; toggles still work per env.
- Admin Modules list matches *installed* catalog; missing packages show “not installed” not just off.
