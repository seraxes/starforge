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
  saveFormsModuleSettingsAction,
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
  createSectionDraft,
  emptyFormDefinitionDocument,
  normalizeFormDefinitionDocument,
  normalizeFormSections,
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
  FORM_WEEKDAY_LABELS,
  describeDateTimeConstraints,
  htmlInputTypeForField,
  isDateTimeFieldType,
  normalizeDateTimeConstraints,
  normalizeValueForType,
  validateDateTimeValue,
} from './date-constraints'
export {
  FORM_CONDITION_OP_LABELS,
  evaluateCondition,
  evaluateConditionGroup,
  isFieldRequired,
  isFieldVisible,
  normalizeFieldLogic,
} from './logic'
export { evaluateFormExpression, formatComputedFixed } from './expr'
export { computeLiveValues, evaluateAndValidateFields } from './evaluate'
export {
  defaultFormsModuleSettings,
  normalizeFormsModuleSettings,
} from './module-settings'
export {
  SF_COMPUTED_KEY,
  SF_DATE_CONSTRAINTS_KEY,
  SF_LOGIC_KEY,
  SF_NUMBER_BOUNDS_KEY,
  SF_OPTIONS_MEDIA_KEY,
  SF_VALIDATE_EXPR_KEY,
  fieldsToJsonSchema,
  isFormFieldType,
  normalizeFormJsonSchema,
  stringifyFormJsonSchema,
  syncSchemaFromFields,
} from './schema-json'
export { validateFieldsWithZod } from './schema-zod'
export { countFormSubmissions, createFormSubmission, listFormSubmissions } from './store'
export {
  getFormsModuleSettings,
  loadFormsModuleSettings,
  saveFormsModuleSettings,
} from './settings-store'
export type {
  FormComputedConfig,
  FormCondition,
  FormConditionGroup,
  FormConditionOp,
  FormDateTimeConstraints,
  FormDefinitionDocument,
  FormDefinitionMeta,
  FormEmailNotifyConfig,
  FormFieldDef,
  FormFieldLogic,
  FormFieldOption,
  FormFieldType,
  FormJsonSchema,
  FormNumberBounds,
  FormOptionMedia,
  FormParticleConfig,
  FormPresetId,
  FormSectionDef,
  FormSubmissionRecord,
  FormSubmitActionState,
  FormValidateExpr,
  FormWeekday,
  FormsModuleSettings,
} from './types'
