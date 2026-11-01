/**
 * Modular Form engine types (SF-65).
 * Field list is canonical; JSON Schema is a derived + editable projection.
 * Definitions live in `sf_forms`; submissions in `sf_form_submissions`.
 */

/** Built-in field kinds for the visual builder + public widget. */
export type FormFieldType =
  | 'text'
  | 'email'
  | 'textarea'
  | 'number'
  | 'tel'
  | 'url'
  | 'select'
  | 'checkbox'

export type FormFieldOption = {
  value: string
  label: string
}

export type FormFieldDef = {
  /** Stable id for DnD / React keys (not the HTML name). */
  id?: string
  /** Stable field name (HTML name attribute / payload key / JSON Schema property). */
  name: string
  label: string
  type: FormFieldType
  required?: boolean
  placeholder?: string
  description?: string
  /** Options for `select` (and later radio groups). */
  options?: FormFieldOption[]
}

/** Typed preset ids — workflow modules reuse these instead of rebuilding fields. */
export type FormPresetId =
  | 'contact'
  | 'survey'
  | 'event-registration'
  | 'voting'
  | 'ticket'
  | 'blank'

/** Loose JSON Schema object (draft-07 shaped) we store + edit. */
export type FormJsonSchema = {
  $schema?: string
  type: 'object'
  title?: string
  description?: string
  properties: Record<string, Record<string, unknown>>
  required?: string[]
  additionalProperties?: boolean
}

export type FormDefinitionDocument = {
  version: 1
  preset: FormPresetId
  title: string
  description?: string
  fields: FormFieldDef[]
  /** Derived JSON Schema; regenerates from fields unless marked dirty. */
  schema: FormJsonSchema
  /** When true, schema was hand-edited; field→schema sync is one-way until reset. */
  schemaDirty?: boolean
  successMessage: string
  submitLabel: string
  useSiteCaptchaDefault: boolean
}

export type FormDefinitionMeta = {
  id: string
  label: string
  preset: FormPresetId
  fieldCount: number
  createdAt: Date
  updatedAt: Date
}

/** Layout slot config for the `form` particle. */
export type FormParticleConfig = {
  /** Preferred: bind a Form definition from Admin → Forms. */
  formId?: string
  /** Optional heading above the form (overrides definition title when set). */
  heading?: string
  /**
   * Legacy inline fields (SF-48). Used when `formId` is empty / definition missing.
   * Prefer editing definitions in the Forms builder going forward.
   */
  fields?: FormFieldDef[]
  successMessage?: string
  submitLabel?: string
  /**
   * When true, use Site Chrome captchaEnabled + captchaProvider
   * (Turnstile keys from env). When false, skip captcha for this instance.
   */
  useSiteCaptchaDefault?: boolean
}

export type FormSubmissionRecord = {
  id: string
  formKey: string
  /** Bound Form definition id when submitted via a definition. */
  definitionId: string | null
  layoutId: string | null
  slotId: string | null
  payload: Record<string, string>
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export type FormSubmitActionState = {
  error?: string
  ok?: boolean
  message?: string
}

export type FormAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  formId?: string
}
