# product:forms

Layer: base

Status: shipped

## Owns

Form **engine** (types, expr, logic, evaluate, store, admin actions, presets) in this folder. Field schema stays form data; the form builder is the layout canvas. Postgres tables `sf_forms`, `sf_form_submissions`, `sf_form_settings` (same names and columns in `schema.ts`). Admin UI in `admin/` (list, builder, settings, submissions). Built-in presets: contact, survey, event-registration, voting, ticket, profile, blank — create-from-preset in Forms admin. Protected built-in definition ids are not deletable. Success mail goes through Email Manager `emitEmailTrigger` only — never `getMailer()` fallback. Companion particle pack: `src/modules/form/` (`id: form`, requires `product:forms`). The Forms list only lists and links; it does not seed Events, Profiles, or Subscriptions definitions (owners seed via `ensureFormDefinitionSeed`).

## Consumes

- **`product:media`** (hard `requires`) — uploads / picker for file fields
- **`product:email-manager`** (`optionalRequires`) — form-submitted / success triggers; soft-skip when off
- Host shims from `admin.routes` so `/admin/forms`, `/admin/forms/settings`, `/admin/forms/[formId]`, and `/admin/forms/submissions` stay the same URLs

## Public door

`@/modules/forms/api` (no `api.server`) — evaluate, presets, `registerFormPreset`, submit, seed:

`listFormDefinitions`, `loadLayoutFormCatalog`, `loadFormDefinition`, `ensureFormDefinitionSeed`, `saveFormDefinitionDocument`, `submitFormAction`, `addFormPresetListener`, `clearFormPresetRegistrations`, `getRegisteredFormPreset`, `listRegisteredFormPresets`, `registerFormPreset`, `runFormPresetOnSubmitted`, `DEFAULT_CONTACT_FORM_ID`, `DEFAULT_EVENT_REGISTRATION_FORM_ID`, `DEFAULT_PROFILE_FORM_ID`, `DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID`, `FORM_PRESETS`, `defaultMessagesForPreset`, `fieldsForPreset`, `getFormPresetMeta`, `isFormPresetId`, `isProtectedFormDefinitionId`, `listFormPresetMetas`, `listFormPresetsByCategory`, `presetSeedFields`, `emptyFormDefinitionDocument`, `formHasCaptchaField`, `serializeFormDefinitionDocument`, `createRowDraft`, `ensureFormSectionsEmptyRows`, `computeLiveValues`, `evaluateAndValidateFields`, `fieldsToJsonSchema`.

Events, Profiles, and Payments import that file only. Catalog / nav views / admin area metadata: `manifest.ts`.

## Admin surfaces

- `/admin/forms`, `/admin/forms/settings`, `/admin/forms/[formId]`, `/admin/forms/submissions`
- ACL area: `forms`
- Dashboard: `forms.submissions`

## Boot and jobs

None. Consumer packs seed their definitions from their own boot (Events / Profiles / Subscriptions).

## Known gaps

- List does not seed Events / Profiles / Subscriptions definitions — owners call `ensureFormDefinitionSeed`
- Captcha / upload security covered by verify scripts outside `test:unit`

## Tests

`src/modules/forms/expr.test.ts`, `logic.test.ts`, `evaluate.test.ts`, `date-constraints.test.ts`, `presets.test.ts`, `rows.test.ts`, `schema.test.ts`, `src/modules/forms/dashboard/forms-stats-format.test.ts`
