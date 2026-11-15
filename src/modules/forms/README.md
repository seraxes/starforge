# product:forms

Form engine and public door (M4).

- Catalog / nav views / admin area metadata: `manifest.ts`
- **Public door:** `api.ts` — evaluate, presets, `registerFormPreset`, submit. Events, Profiles, and Payments import that file only.
- Engine (types, expr, logic, evaluate, store, admin actions, presets) lives in this folder
- Admin UI lives in `admin/` (list, builder, settings, submissions). `admin.routes` generates host shims, so `/admin/forms`, `/admin/forms/settings`, `/admin/forms/[formId]`, and `/admin/forms/submissions` stay the same URLs. The list only lists and links. It does not seed Events, Profiles, or Subscriptions definitions.
- The form builder is the layout canvas. Field schema stays form data. Postgres tables `sf_forms`, `sf_form_submissions`, and `sf_form_settings` are declared in `schema.ts` (same names and columns). Packs seed a missing definition through `ensureFormDefinitionSeed` on `api.ts`.
- Companion particle: `src/modules/form/` (`id: form`, requires `product:forms`)
- Built-in presets: contact, survey, event-registration, voting, ticket, profile, blank — create-from-preset in Forms admin
