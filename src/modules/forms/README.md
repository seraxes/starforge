# product:forms

Form engine and public door (M4).

## Owns

- Form engine (types, expr, logic, evaluate, store, admin actions, presets) in this folder
- Field schema stays form data; the form builder is the layout canvas
- Postgres tables `sf_forms`, `sf_form_submissions`, and `sf_form_settings` (same names and columns in `schema.ts`)
- Admin UI in `admin/` (list, builder, settings, submissions)
- Built-in presets: contact, survey, event-registration, voting, ticket, profile, blank — create-from-preset in Forms admin

## Consumes

- Host shims from `admin.routes` so `/admin/forms`, `/admin/forms/settings`, `/admin/forms/[formId]`, and `/admin/forms/submissions` stay the same URLs

## Public door

- `@/modules/forms/api` — evaluate, presets, `registerFormPreset`, submit
- Packs seed a missing definition through `ensureFormDefinitionSeed` on that door
- Events, Profiles, and Payments import that file only

- Catalog / nav views / admin area metadata: `manifest.ts`
- The list only lists and links. It does not seed Events, Profiles, or Subscriptions definitions.
- Companion particle: `src/modules/form/` (`id: form`, requires `product:forms`)
