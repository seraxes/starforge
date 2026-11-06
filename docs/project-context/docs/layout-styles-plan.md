# Layout Styles plan (SF-34 / SF-64)

Gantry Helium Styles reference (`media/gantry-core-section-styles.png`).

## CSS layers (keep separate)

1. **Design tokens** — `:root` (brand/surfaces; later Tailwind / SF-33 Core Styles accents & fonts).
2. **Outline Layout Styles** — section full/boxed + **section background/text/image/overlay** + outline breakpoints (`--sf-bp-*`, `--sf-container-max`). Lives in the layout document for the active outline.
3. **Custom CSS** — Page Settings document chrome / Custom particle only. **Not** mixed into admin chrome.

## Principles

- **Outline-scoped:** every style/breakpoint set follows the active layout outline (same as Layout canvas). Global default = default outline.
- **Section owns width + Section Styles:** per section `containerMode: full | boxed` and `styles` (bg/text/image/overlay). Row % stays share *inside* the section container.
- **Live sections only:** Styles lists the current outline’s sections — no fixed Navigation/Header name map. Deleting a section drops its Styles entry with it.
- **Breakpoints** (Large Desktop / Desktop / Tablet / Mobile / Mobile menu) are outline-level, not per-section.

## UX

1. **Layouts → Styles** (`/app/admin/breakpoints`): Gantry-like **Section Styles** panels for each live section (Background, Text, Background Image, Overlay + color, allow gradient backgrounds/overlays) plus **Breakpoints** below.
2. **Layout editor — section Settings:** Full width / Boxed width; quick Background + Text color (same `section.styles` fields).
3. Core Styles color/font matrix stays with theme SF-33; particle defaults stay separate later.

## Data

- Section fields on layout JSON: `containerMode`, `styles: { backgroundColor?, textColor?, backgroundImage?, backgroundOverlay?, overlayColor?, allowGradientBackground?, allowGradientOverlay? }`.
- Outline document `styles.breakpoints` (+ future core accent tokens).

## Public render

- Inline `--sf-section-bg` / `--sf-section-text` / background-image; `data-sf-overlay="enabled"` paints overlay via `::before` + `--sf-section-overlay`.

## Out of this slice / later

- Full Core Styles color/font matrix (defer with theme SF-33).
- Media library picker for background image (URL field for now; wire after SF-28 → SF-66).
- Delete-section warning that Styles entry will disappear.
