/**
 * Forms module public API (design-module-boundary §6).
 *
 * Engine still lives under `src/core/forms` until M4; this file is the stable
 * import path other modules (Events, …) should use for presets + hooks.
 *
 *   import { registerFormPreset } from '@/modules/forms/api'
 *
 * Do not invent a second form builder — seed fields + optional `onSubmitted` only.
 */

export {
  clearFormPresetRegistrations,
  getRegisteredFormPreset,
  listRegisteredFormPresets,
  registerFormPreset,
  runFormPresetOnSubmitted,
} from '@/core/forms/preset-registry'
export type {
  FormPresetMessages,
  FormPresetOnSubmitted,
  FormPresetRegistration,
  FormSubmittedContext,
} from '@/core/forms/preset-registry'

export {
  DEFAULT_CONTACT_FORM_ID,
  FORM_PRESETS,
  defaultMessagesForPreset,
  fieldsForPreset,
  getFormPresetMeta,
  isFormPresetId,
  listFormPresetMetas,
  presetSeedFields,
} from '@/core/forms/presets'

export type { FormFieldDef, FormPresetId, FormSubmissionPayload } from '@/core/forms/types'

/** Evaluate / schema helpers other packs may reuse without deep Core imports. */
export { evaluateAndValidateFields } from '@/core/forms/evaluate'
export { fieldsToJsonSchema } from '@/core/forms/schema-json'
