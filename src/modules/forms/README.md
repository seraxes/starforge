# product:forms

Manifest + public API for the Forms capability (SF-141 M0; presets P2).

- Catalog / nav views / admin area metadata: `manifest.ts`
- **Public seam for other modules:** `api.ts` → `registerFormPreset({ id, label, seedFields, onSubmitted? })`
- Engine, admin UI, and Drizzle tables still live under `src/core/forms` until M4 moves them here
- Companion particle: `src/modules/form/` (`id: form`, requires `product:forms`)
- Built-in presets: contact, survey, event-registration, voting, ticket, blank — create-from-preset in Forms admin
