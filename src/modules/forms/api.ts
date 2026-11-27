/**
 * Forms module public door.
 *
 * Events, Profiles, and Payments import this file only:
 *
 *   import { registerFormPreset, evaluateAndValidateFields, submitFormAction } from '@/modules/forms/api'
 *
 * Evaluate, presets, `registerFormPreset`, and submit live here. Definition
 * load/save and submit call into the engine when invoked, so this file stays
 * free of `server-only` and unit tests can import the pure helpers.
 *
 * The Form particle binds the server action from `./actions` for
 * `useActionState`. Forms admin imports engine leaves. Field schema stays
 * form data. Do not invent a second builder — seed fields plus `onSubmitted`.
 */

import type { FormDefinitionLoadResult } from './definitions-store'
import type { FormDefinitionDocument, FormSubmitActionState } from './types'

export type { FormDefinitionLoadResult }

export {
  addFormPresetListener,
  clearFormPresetRegistrations,
  getRegisteredFormPreset,
  listRegisteredFormPresets,
  registerFormPreset,
  runFormPresetOnSubmitted,
} from './preset-registry'
export type {
  FormPresetMessages,
  FormPresetOnSubmitted,
  FormPresetOnSubmittedResult,
  FormPresetRegistration,
  FormSubmittedContext,
} from './preset-registry'

export {
  DEFAULT_CONTACT_FORM_ID,
  DEFAULT_EVENT_REGISTRATION_FORM_ID,
  DEFAULT_PROFILE_FORM_ID,
  DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID,
  FORM_PRESETS,
  defaultMessagesForPreset,
  fieldsForPreset,
  getFormPresetMeta,
  isFormPresetId,
  isProtectedFormDefinitionId,
  listFormPresetMetas,
  listFormPresetsByCategory,
  presetSeedFields,
} from './presets'

export {
  emptyFormDefinitionDocument,
  formHasCaptchaField,
  serializeFormDefinitionDocument,
} from './definition'

export { createRowDraft, ensureFormSectionsEmptyRows } from './rows'

export { computeLiveValues, evaluateAndValidateFields } from './evaluate'
export { fieldsToJsonSchema } from './schema-json'

export type {
  FormDefinitionDocument,
  FormFieldDef,
  FormFieldOption,
  FormPresetId,
  FormSectionDef,
  FormSubmissionPayload,
  FormSubmitActionState,
} from './types'

export async function listFormDefinitions() {
  const { listFormDefinitions: list } = await import('./definitions-store')
  return list()
}

/** Layout manager catalog. Seeds the contact form, then returns id + label. */
export async function loadLayoutFormCatalog(): Promise<Array<{ id: string; label: string }>> {
  const { ensureDefaultContactFormSeeded } = await import('./definitions-store')
  await ensureDefaultContactFormSeeded()
  const defs = await listFormDefinitions()
  return defs.map((form) => ({
    id: form.id,
    label: form.label?.trim() || form.id,
  }))
}

export async function loadFormDefinition(formId: string): Promise<FormDefinitionLoadResult> {
  const { loadFormDefinition: load } = await import('./definitions-store')
  return load(formId)
}

/**
 * Insert-if-missing for a protected definition. Events, Profiles, and
 * Subscriptions seed through this door. An existing row is left unchanged.
 */
export async function ensureFormDefinitionSeed(input: {
  id: string
  document: FormDefinitionDocument
  label?: string
}) {
  const { ensureFormDefinitionSeed: seed } = await import('./definitions-store')
  return seed(input)
}

export async function saveFormDefinitionDocument(
  formId: string,
  document: FormDefinitionDocument,
  label?: string,
): Promise<FormDefinitionDocument> {
  const { saveFormDefinitionDocument: save } = await import('./definitions-store')
  return save(formId, document, label)
}

/**
 * Create a new definition (label + optional preset / id / copy).
 * Consumers (e.g. Onboarding status Create) call this door — never Forms private files.
 */
export async function createFormDefinition(input: {
  label: string
  id?: string
  preset?: FormPresetId
  copyFromId?: string
}): Promise<{ id: string; document: FormDefinitionDocument }> {
  const { createFormDefinition: create } = await import('./definitions-store')
  return create(input)
}

/**
 * Programmatic submit for other packs. Same checks as the Form particle.
 * The particle keeps a direct `./actions` binding for `useActionState`.
 */
export async function submitFormAction(
  prev: FormSubmitActionState,
  formData: FormData,
): Promise<FormSubmitActionState> {
  const { submitFormAction: submit } = await import('./actions')
  return submit(prev, formData)
}
