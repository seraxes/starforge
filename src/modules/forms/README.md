# product:forms

Form engine and public door (M4).

- Catalog / nav views / admin area metadata: `manifest.ts`
- **Public door:** `api.ts` — evaluate, presets, `registerFormPreset`, submit. Events, Profiles, and Payments import that file only.
- Engine (types, expr, logic, evaluate, store, admin actions, presets) lives in this folder
- Forms admin stays at `/admin/forms`. The form builder is the layout canvas. Field schema stays form data (`sf_forms` / `sf_form_submissions` in the Core Drizzle schema)
- Companion particle: `src/modules/form/` (`id: form`, requires `product:forms`)
- Built-in presets: contact, survey, event-registration, voting, ticket, profile, blank — create-from-preset in Forms admin
