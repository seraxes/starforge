/**
 * Modular Form engine types (SF-65).
 * Field list is canonical; JSON Schema is a derived + editable projection.
 * Definitions live in `sf_forms`; submissions in `sf_form_submissions`.
 *
 * Client-safe — do not add server-only imports here.
 */

import type { CaptchaProvider } from '@/core/site-chrome/types'

/** Built-in field kinds for the visual builder + public widget. */
export type FormFieldType =
  | 'text'
  | 'email'
  | 'textarea'
  | 'number'
  | 'tel'
  | 'url'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkbox-group'
  | 'date'
  | 'time'
  | 'datetime'
  /** Read-only derived number from a math expression over other fields. */
  | 'computed'

/**
 * Interim media bind for an option (SF-28 will resolve Payload media ids).
 * Prefer `mediaId` when the library exists; `url` is the interim public bind.
 */
export type FormOptionMedia = {
  /** Payload media document id when available. */
  mediaId?: string
  /** Interim or resolved public URL / path. */
  url?: string
  /** Optional alt text for images / icons. */
  alt?: string
  /** Hint for render: image | icon | file (default image when url looks like media). */
  kind?: 'image' | 'icon' | 'file'
}

export type FormFieldOption = {
  value: string
  label: string
  /** Optional media attachment per option (select / radio / checkbox-group). */
  media?: FormOptionMedia
}

/**
 * Weekday filter for date / datetime fields.
 * Matches `Date#getDay()`: 0 = Sunday … 6 = Saturday.
 */
export type FormWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Inclusive range + calendar filters for date / time / datetime fields.
 * Empty `weekdays` / `daysOfMonth` means no filter (any day).
 * Combinations are AND’d (must satisfy every set constraint).
 */
export type FormDateTimeConstraints = {
  /** Inclusive lower bound — `YYYY-MM-DD`, `HH:mm`, or `YYYY-MM-DDTHH:mm`. */
  min?: string
  /** Inclusive upper bound — same shapes as `min`. */
  max?: string
  /** Allowed weekdays (date / datetime only). */
  weekdays?: FormWeekday[]
  /** Allowed calendar days 1–31 (date / datetime only). */
  daysOfMonth?: number[]
}

/** Comparison / membership ops for conditional field rules. */
export type FormConditionOp =
  | 'eq'
  | 'neq'
  | 'in'
  | 'notIn'
  | 'empty'
  | 'notEmpty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'

export type FormCondition = {
  /** Other field `name` to compare against. */
  field: string
  op: FormConditionOp
  /** Comparison value(s). Unused for empty / notEmpty. */
  value?: string | string[]
}

export type FormConditionGroup = {
  logic: 'and' | 'or'
  conditions: FormCondition[]
}

/**
 * Per-field conditional visibility + dynamic required.
 * Pages/sections can reuse the same group shape later.
 */
export type FormFieldLogic = {
  /** Show when group matches; omit = always visible. */
  showWhen?: FormConditionGroup
  /** Dynamic required when group matches (overrides static `required` when set). */
  requireWhen?: FormConditionGroup
}

/** Computed / derived numeric value (schema-driven; no SurveyJS). */
export type FormComputedConfig = {
  /**
   * Safe expression over field names: `price * qty`, `sum(a, b)`, `min(x, y)`.
   * Functions: sum, min, max, abs, round.
   */
  expression: string
  /** Decimal places for display + submitted value (default 2). */
  precision?: number
}

/**
 * Math-aware validation for numeric / computed fields.
 * `expression` must evaluate truthy (supports comparisons + arithmetic).
 */
export type FormValidateExpr = {
  expression: string
  message?: string
}

/** Optional min/max resolved from expressions at evaluate time. */
export type FormNumberBounds = {
  /** Static min (number fields). */
  min?: number
  /** Static max. */
  max?: number
  /** Expression → number used as min when present. */
  minExpr?: string
  /** Expression → number used as max when present. */
  maxExpr?: string
}

/**
 * Per-form email notify preferences (transport stub until email is wired).
 * Module defaults live in Forms → Settings.
 */
export type FormEmailNotifyConfig = {
  /** Send a copy to admin address(es). */
  notifyAdmin?: boolean
  /** Send a confirmation to the respondent email field. */
  notifyRespondent?: boolean
  /** Field name that holds the respondent email (default `email`). */
  respondentEmailField?: string
  /** Override Forms Settings default admin recipients (comma-separated in UI). */
  adminEmails?: string[]
  adminSubject?: string
  respondentSubject?: string
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
  /** Options for select / radio / checkbox-group. */
  options?: FormFieldOption[]
  /** Constraints for date / time / datetime fields. */
  constraints?: FormDateTimeConstraints
  /** Show / require rules based on other field values. */
  logic?: FormFieldLogic
  /** For `computed` fields — expression that derives the value. */
  computed?: FormComputedConfig
  /** Truthy expression checked on submit (and optionally live). */
  validateExpr?: FormValidateExpr
  /** Static / expression bounds for number (+ computed display). */
  numberBounds?: FormNumberBounds
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

/**
 * Visual grouping in the Form builder (section-like, not layout rows/%).
 * Fields stay canonical/flat; sections only order + label groups for admin + public.
 */
export type FormSectionDef = {
  id: string
  label: string
  /** Ordered field `name`s belonging to this section. */
  fieldNames: string[]
}

export type FormDefinitionDocument = {
  version: 1
  preset: FormPresetId
  title: string
  description?: string
  fields: FormFieldDef[]
  /** Builder/public section grouping (Layout-like chrome; different data model). */
  sections?: FormSectionDef[]
  /** Derived JSON Schema; regenerates from fields unless marked dirty. */
  schema: FormJsonSchema
  /** When true, schema was hand-edited; field→schema sync is one-way until reset. */
  schemaDirty?: boolean
  /** Shown on the public widget after a successful submit. */
  successMessage: string
  submitLabel: string
  useSiteCaptchaDefault: boolean
  /** Email-on-submit preferences (stub until transport exists). */
  emailNotify?: FormEmailNotifyConfig
}

/**
 * Module-level Forms Settings (Forms → Settings).
 * Email transport stays stubbed until platform email is available.
 */
export type FormsModuleSettings = {
  version: 1
  /** Default admin recipients for notifyAdmin (comma-separated in UI). */
  defaultAdminEmails: string[]
  /** From address used when transport is ready (stored now). */
  fromAddress: string
  /** Only `stub` until email is wired — logs / records intent, does not send. */
  transport: 'stub'
  /** Default success message seeded into new form definitions. */
  defaultSuccessMessage: string
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

/** Resolved captcha challenge for a Form instance (public props / server verify). */
export type ResolvedCaptcha = {
  /** Whether this form instance should challenge the visitor. */
  required: boolean
  provider: CaptchaProvider
  /** Public site key (Turnstile) when required + provider is turnstile. */
  siteKey: string | null
  /** Human-readable reason when required but misconfigured. */
  misconfiguredReason?: string
}
