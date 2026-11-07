/**
 * Modular Form engine types (SF-65).
 * Field list is canonical; JSON Schema is a derived + editable projection.
 * Definitions live in `sf_forms`; submissions in `sf_form_submissions`.
 *
 * Client-safe — do not add server-only imports here.
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
  | 'radio'
  | 'checkbox'
  | 'checkbox-group'
  | 'date'
  | 'time'
  | 'datetime'
  /** Respondent file → Payload Media id in the submission payload. */
  | 'file'
  /** Non-editable value (tracking / context); uses `defaultValue`. */
  | 'hidden'
  /** Read-only derived number from a math expression over other fields. */
  | 'computed'
  /**
   * Places Turnstile (or future provider) on the canvas.
   * Config comes from Site Settings → Security + env keys — not per-field secrets.
   */
  | 'captcha'

/**
 * String length / regex constraints for text-like fields (and hidden).
 * Complements `validateExpr` for common contact/ticket cases.
 */
export type FormStringConstraints = {
  /** Inclusive minimum length (Unicode code units / JS string length). */
  minLength?: number
  /** Inclusive maximum length. */
  maxLength?: number
  /** JS RegExp source (no surrounding slashes); matched against the whole value. */
  pattern?: string
  /** Message when `pattern` fails (length messages are generated). */
  patternMessage?: string
}

/**
 * Upload limits for `file` fields — stored media goes into the single Payload
 * library as private (folder=forms). Server clamps accept (no SVG) and size
 * to FORM_FILE_HARD_MAX_BYTES; client fieldsJson cannot widen these.
 */
export type FormFileUploadConfig = {
  /**
   * HTML `accept` list (e.g. `image/png,application/pdf`).
   * Empty → Core default allowlist (raster images + PDF + plain text + Word).
   * SVG is always rejected for anonymous Form uploads.
   */
  accept?: string
  /** Max bytes per file (default / hard max 10 MiB). */
  maxSizeBytes?: number
}

/**
 * Option media bind (SF-66) — Payload library id is primary; url is fallback / cache.
 */
export type FormOptionMedia = {
  /** Payload media document id (primary). */
  mediaId?: string
  /** Resolved or advanced-fallback public URL / path. */
  url?: string
  /** Optional alt text for images / icons. */
  alt?: string
  /** Hint for render: image | icon | file (default image when url looks like media). */
  kind?: 'image' | 'icon' | 'file'
}

export type FormFieldOption = {
  value: string
  label: string
  /** When true, option is shown but not selectable (e.g. sold-out ticket tier). */
  disabled?: boolean
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
 * Per-form email notify preferences (platform Mailer via Site Chrome).
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
  /**
   * Seed / fixed value — required for `hidden`; also applied when a visible
   * text-like field is submitted empty.
   */
  defaultValue?: string
  /** Options for select / radio / checkbox-group. */
  options?: FormFieldOption[]
  /** Constraints for date / time / datetime fields. */
  constraints?: FormDateTimeConstraints
  /** Length / pattern rules for text-like (+ hidden) fields. */
  stringConstraints?: FormStringConstraints
  /** Accept / size for `file` fields (Payload Media bind). */
  upload?: FormFileUploadConfig
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
 * One column inside a form layout row (Gantry-like % width).
 * Fields stay canonical/flat on `FormDefinitionDocument.fields`; rows only place them.
 */
export type FormRowColumn = {
  /** Field `name` rendered in this column. */
  fieldName: string
  /** Width percent (5–100). Same model as Layout slots. */
  width: number
}

/** Side-by-side field group within a section (stacks on mobile). */
export type FormRowDef = {
  id: string
  columns: FormRowColumn[]
}

/**
 * Visual grouping in the Form builder (section → rows → %-width columns).
 * Fields stay canonical/flat; sections own order + labels + row layout for admin + public.
 */
export type FormSectionDef = {
  id: string
  label: string
  /** Layout rows (one or more fields side-by-side). */
  rows: FormRowDef[]
  /**
   * Legacy single-column order (pre-row-layout). Accepted on normalize;
   * migrated into `rows` (one field per row at 100%) and omitted on save.
   */
  fieldNames?: string[]
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
  /**
   * Optional post-submit redirect (relative path only, e.g. `/thanks`).
   * When set, the public widget navigates after a successful submit.
   */
  successRedirectUrl?: string
  submitLabel: string
  useSiteCaptchaDefault: boolean
  /** Email-on-submit preferences (uses platform Mailer when Site Chrome email is on). */
  emailNotify?: FormEmailNotifyConfig
}

/**
 * Module-level Forms Settings (Forms → Settings).
 * Transport is always the platform Mailer (Site Chrome enable/provider).
 */
export type FormsModuleSettings = {
  version: 1
  /** Default admin recipients for notifyAdmin (comma-separated in UI). */
  defaultAdminEmails: string[]
  /** From override for form mail; empty → Site Chrome emailFrom / STARFORGE_MAIL_FROM. */
  fromAddress: string
  /** Always platform Mailer — retained for stored JSON compatibility. */
  transport: 'platform'
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

/** How the Form particle gets its field schema. */
export type FormParticleSource = 'definition' | 'custom'

/** Layout slot config for the `form` particle. */
export type FormParticleConfig = {
  /**
   * `definition` — pick a Form from Admin → Forms (`formId`).
   * `custom` — paste/own JSON (fields array, definition doc, or JSON Schema).
   * Omitted on older slots: inferred from formId vs fields.
   */
  source?: FormParticleSource
  /** Bind a Form definition id/slug when source is `definition`. */
  formId?: string
  /** Optional heading above the form (overrides definition title when set). */
  heading?: string
  /**
   * Custom / inline fields when source is `custom` (or legacy slots without formId).
   * Prefer Admin → Forms definitions when the Forms module is on.
   */
  fields?: FormFieldDef[]
  successMessage?: string
  submitLabel?: string
  /**
   * When true, use Site Settings → Security captchaEnabled + captchaProvider
   * (stored on Site Chrome JSON; Turnstile keys from env). When false, skip captcha.
   */
  useSiteCaptchaDefault?: boolean
}

/**
 * Stored submission field values (jsonb).
 * Scalars remain strings for the public widget; checkbox-group / multi-file
 * may use string arrays. Numbers/booleans allowed for typed presets later.
 */
export type FormSubmissionPayload = Record<
  string,
  string | string[] | number | boolean | null
>

export type FormSubmissionRecord = {
  id: string
  formKey: string
  /** Bound Form definition id when submitted via a definition. */
  definitionId: string | null
  /** FormDefinitionDocument.version frozen at submit (SF-139). */
  definitionVersion: number | null
  /** Field defs (or hash object) frozen at submit for CSV/audit (SF-139). */
  fieldsSnapshot: unknown
  /** Better Auth user id when signed in; null for anonymous. */
  userId: string | null
  layoutId: string | null
  slotId: string | null
  payload: FormSubmissionPayload
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export type FormSubmitActionState = {
  error?: string
  ok?: boolean
  message?: string
  /** Relative success redirect from the definition (open-redirect safe). */
  redirectUrl?: string
}

export type FormAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  formId?: string
}

/** Resolved captcha challenge — re-export from security captcha port. */
export type {
  CaptchaProvider,
  ResolvedCaptcha,
} from '@/core/security/captcha/types'
