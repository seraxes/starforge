---
kind: decision
last_verified: 2026-11-22
---
# Decision: Payload peel

**Status:** done (2026-11-16). Phases 1–4 shipped. The content manager is `product:pages`. The `/cms` shell and the CMS npm packages are gone. `@payloadcms/richtext-lexical` stays for `product:lexical-editor`.

**Date:** 2026-11-15

**Decision:** Do not vendor or fork Payload source. Peel `getPayload()` callers, then delete the npm packages. `product:media` owns media, including the document store still in Payload (meta, categories, media-tags, blobs via MediaStorage). `product:pages` (`src/modules/pages`, not Core, `requires` rich-editor and media) is the chosen content manager behind `PageReadsPort` (editorial pages, drafts, page admin, page tags). Site settings (toggles, performance, `primaryNavMenuId`) move to Core `sf_*`, not a CMS. Media peels before pages. The Payload UI stays until both parity bars are green. `PageReadsPort` stays the swap boundary. Payload is not a long-lived second CMS. Media and site settings do not go back into Payload.

**Constraint (one sentence an agent can follow):** Do not vendor or fork Payload source: peel `getPayload` callers (settings, then media, then pages, then the shell), then delete the npm packages; `product:media` owns the media document store, `product:pages` in `src/modules/pages` is the content manager behind `PageReadsPort`, site settings move to Core `sf_*`, and the Payload UI stays until the media bar and then the pages bar are green.

**Files to update:**

- Rule: `.cursor/rules/sf-architecture.mdc` (content manager, media store, site settings, peel)
- Live map: `docs/project-context/docs/architecture-current.md` (Content manager; peel is open work)
- Owner README: `src/modules/media/README.md` (will take the document store; Payload is not the long-term store)
- Map: `docs/archive/payload-dependency-map.md` (buckets, packages, order 0→4, parity bars)
- Preferences: `docs/project-context/preferences.md` (current-overrides content-manager bullet)
- Pages one-pager: `docs/project-context/docs/pages-pack-plan.md` (phase 3 only — no `src/modules/pages`)
