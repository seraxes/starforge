/**
 * Starforge Form engine public surface (SF-65).
 *
 * **Client components** must import from leaf modules — not this barrel:
 * - `@/core/forms/actions` (server actions)
 * - `@/core/forms/types` (types)
 * - `@/core/forms/presets` / `definition` / `schema-json` / `config` (pure helpers)
 *
 * Do **not** import this barrel from client components — it re-exports
 * server-only captcha verify, DB stores, and session helpers (`import 'server-only'`).
 */

export {
  createFormDefinitionAction,
  deleteFormDefinitionAction,
  duplicateFormDefinitionAction,
  ensureDefaultContactFormSeeded,
  listFormDefinitions,
  listFormDefinitionsForAdmin,
  listFormSubmissionsForAdmin,
  loadFormDefinition,
  requireFormsAdmin,
  saveFormDefinitionAction,
  submitFormAction,
} from './actions'
export type { FormAdminActionState } from './actions'
export {
  defaultFormConfig,
  defaultFormFields,
  formConfigToSlotConfig,
  mergeParticleWithDefinition,
  normalizeFormFields,
  readFormConfig,
} from './config'
/** Server-only resolve + Turnstile verify (`import 'server-only'`). */
export { resolveFormCaptcha, verifyTurnstileToken } from './captcha'
export type { ResolvedCaptcha } from './types'
export {
  createFieldDraft,
  emptyFormDefinitionDocument,
  normalizeFormDefinitionDocument,
  parseFormDefinitionJson,
  serializeFormDefinitionDocument,
  slugifyFormId,
  DEFAULT_CONTACT_FORM_ID,
} from './definition'
export {
  createFormDefinition,
  deleteFormDefinition,
  duplicateFormDefinition,
  listFormDefinitions as listFormDefinitionMetas,
  loadFormDefinition as loadFormDefinitionDoc,
  saveFormDefinitionDocument,
} from './definitions-store'
export {
  DEFAULT_CONTACT_FORM_ID as CONTACT_FORM_ID,
  FORM_PRESETS,
  defaultMessagesForPreset,
  fieldsForPreset,
  getFormPresetMeta,
  isFormPresetId,
  presetSeedFields,
} from './presets'
export { checkFormRateLimit, clearFormRateLimitBuckets } from './rate-limit'
export {
  fieldsToJsonSchema,
  isFormFieldType,
  normalizeFormJsonSchema,
  stringifyFormJsonSchema,
  syncSchemaFromFields,
} from './schema-json'
export { fieldsToZodSchema, validateFieldsWithZod } from './schema-zod'
export { countFormSubmissions, createFormSubmission, listFormSubmissions } from './store'
export type {
  FormDefinitionDocument,
  FormDefinitionMeta,
  FormFieldDef,
  FormFieldOption,
  FormFieldType,
  FormJsonSchema,
  FormParticleConfig,
  FormPresetId,
  FormSubmissionRecord,
  FormSubmitActionState,
} from './types'
