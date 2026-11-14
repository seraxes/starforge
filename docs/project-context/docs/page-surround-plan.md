# Page surround / full-height public page (SF-75)

Gantry analogy: `#g-page-surround` wraps header + layout sections + footer so the **whole page** fills the viewport (not the article alone). Starforge maps that to the existing public layout tree — prefer the **smallest correct CSS fix**, not a new nested wrapper by default.

## Problem

`.cms-page { min-height: 100vh }` stretches only the Payload article inside the `page-content` particle. Header + article + footer then exceed one viewport. That is not a page-surround.

## Prefer (ship this)

1. **Height chain on `html` / `body` / `body > main`:** `min-height: 100vh` then `min-height: 100dvh` so the document fills the dynamic viewport.
2. **`body > main` flex column** so the public shell (and admin shell) can grow with the viewport even when chrome siblings exist (offline banner, Page Settings body injects).
3. **`.public-shell`** stays the flex column that already paints layout sections (header → main → footer). Give it `flex: 1` (plus a `min-height` fallback) so it fills `main`. Keep sticky footer: `margin-top: auto` on the last `.site-footer`. Footer copy is an outline particle — the shell does not append a credit line.
4. **Remove** `min-height` from `.cms-page` — padding/typography only. Section full/boxed width stays SF-34.

`.public-shell` already plays Gantry’s surround role (outer wrapper for layout particles/sections). No new DOM node required for this slice.

## Defer explicit `#sf-page-surround` wrapper

Add a dedicated inner surround **only if** body/`main` stretch proves insufficient — e.g. offcanvas outside the fill box, page-level background behind sections but above body chrome, or body top/bottom injects that must sit outside the height box. Until then, document `.public-shell` as the surround; optional later `id="sf-page-surround"` on that same node for Gantry-like selectors (no extra wrapper).

## Map to layout model

| Gantry | Starforge |
| --- | --- |
| `#g-page-surround` | `.public-shell` (defer nested wrapper) |
| Sections inside surround | `.sf-layout-section` / footer sections |
| Particles | Core registry particles (`page-content`, logo, menu, …) |
| Boxed / full | Section `containerMode` (SF-34) |
| Sticky footer | Flex column + `margin-top: auto` on last footer |

## Out of scope

- Page surround video. Page background image is Layouts → Styles → Page background (`styles.body`).
- Offcanvas / mobile drawer hosting outside the shell
- Changing section paint order or layout JSON
