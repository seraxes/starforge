# Page Settings submenu plan

Gantry Helium–style **Page Settings** for Starforge Core (see user screenshot: Head Properties, Assets, Body Attributes, Font Awesome, Atoms). Core owns chrome + layout assignment; Payload keeps page body / base SEO.

## Goal

Admin UI mirroring Gantry’s Page Settings tabs/panels: global (site) defaults + per-page overrides; optional **Atoms** (non-visual injectors) as a registry like particles.

## UI map (from Gantry)

### Head Properties
- **Meta Tags** — repeatable name/property + content (add/remove rows), not only title/description.
- **Custom Content** — free HTML in `<head>` (manifest links, scripts, etc.). Developer-admin.

### Assets
- **Favicon** + **Touch Icon** — Media/URL (Gantry `gantry-media://…` → our Media id/URL).
- **CSS** — ordered, named list of stylesheets (drag reorder, add/remove).
- **JavaScript** — ordered, named list of scripts (same UX).

### Body Attributes
- **Body Id**, **Body Classes** (chip/tag style later; v1 text).
- **Tag Attributes** — extra attributes string on `<body>` (e.g. `data-*`).
- **Sections Layout** — dropdown: Fullwidth / Boxed content (maps to layout wrapper mode; can default from layout later).
- **After `<body>`** / **Before `</body>`** — HTML textareas. Developer-admin.

### Font Awesome Settings
- Enable, V4 Compatibility, Content Compatibility toggles.
- Version select (e.g. FA 6/7 Free).
- Optional override: CSS Link HTML / JS Script HTML (advanced).
- Site-level integration; page can inherit/on/off later.

### Atoms (non-visual)
Gantry atoms = headroom, analytics, custom CSS/JS, JS frameworks, lightcase, etc.
- Starforge: **Atom registry** (same pattern as particles): id, label, config schema, inject into head/body.
- v1 atoms: **Custom CSS/JS**, **Google Analytics** (or generic analytics id).
- Later: Headroom, Lightcase, JS frameworks — add as modules when needed.
- Admin: pill buttons to add atom; list with settings gear → **popup overlay** (same as layout particle editors).

Also keep: **layout outline assignment** (page → `sf_layouts`) — Gantry ties this to outlines; we expose it on Page Settings or adjacent submenu.

## Scope split

### v1 (SF-37)
1. Site default chrome + per-page override merge.
2. Head: meta tags list + custom head HTML.
3. Assets: favicon, touch icon, ordered CSS/JS lists (name + URL).
4. Body: id, classes, tag attributes, after/before body HTML.
5. Sections layout mode enum (fullwidth | boxed).
6. Layout assignment field.
7. Font Awesome site panel (enable + version + optional CSS/JS override HTML).
8. Atoms: registry + Custom CSS/JS atom + Analytics atom; popup settings.
9. Admin: **Layouts → Page settings** nested submenu (not top-level); route `/app/admin/page-settings` + page picker / per-page edit; collapse/expand panels like Gantry optional.

### Later
- Richer meta (OG presets), Media picker for every asset, more atoms, menu-item chrome, Layout Styles (SF-34), dark theme (SF-33).

## Data sketch

```ts
type AssetRef = { id: string; name: string; url: string };
type MetaTag = { id: string; nameOrProperty: string; content: string };

type PageChrome = {
  pageKey?: string | null; // null = site global
  layoutId?: string;
  sectionsLayout?: "fullwidth" | "boxed";
  metaTags?: MetaTag[];
  customHeadHtml?: string;
  faviconUrl?: string;
  touchIconUrl?: string;
  css?: AssetRef[];
  javascript?: AssetRef[];
  bodyId?: string;
  bodyClasses?: string;
  bodyTagAttributes?: string;
  afterBodyHtml?: string;
  beforeBodyCloseHtml?: string;
  fontAwesome?: {
    enabled?: boolean;
    v4Compat?: boolean;
    contentCompat?: boolean;
    version?: string;
    cssLinkHtml?: string;
    jsScriptHtml?: string;
  };
  atoms?: Array<{ id: string; type: string; enabled: boolean; config: Record<string, unknown> }>;
};
```

## ACL
- Meta, classes, favicon, CSS URLs, FA enable: admin.
- Custom head, body hooks, JS lists, inline/atom scripts: developer-admin.

## Success criteria (v1)
- Global Page Settings UI covers Head / Assets / Body / FA / Atoms like the screenshot structure.
- Per-page override merges over global.
- Public HTML emits meta, icons, CSS/JS order, body attrs, hooks, FA when enabled, atom injectors.
- Atom settings open as overlay popup (not expanding the row).

## Implementation order
1. Schema + merge resolver.
2. Document shell emitter in public layout.
3. Admin panels (global then per-page).
4. FA + two atoms.
5. Seed global defaults.
