/**
 * Email Manager shared types (product:email-manager).
 * Transport stays Core Mailer — these shape rules, templates, and triggers only.
 */

/** Catalog / filter bucket shown in admin (Forms, Auth, Events, …). */
export const EMAIL_MODULE_CATEGORIES = [
  'forms',
  'auth',
  'events',
  'social',
  'marketplace',
  'system',
  'other',
] as const

export type EmailModuleCategory = (typeof EMAIL_MODULE_CATEGORIES)[number]

export function isEmailModuleCategory(value: unknown): value is EmailModuleCategory {
  return (
    typeof value === 'string' &&
    (EMAIL_MODULE_CATEGORIES as readonly string[]).includes(value)
  )
}

/** How a rule decides to send. */
export type EmailRuleMode = 'automatic' | 'conditional'

export function isEmailRuleMode(value: unknown): value is EmailRuleMode {
  return value === 'automatic' || value === 'conditional'
}

/**
 * Simple predicate on trigger payload (not a second Form builder).
 * Paths use dot notation (`payload.email`, `formKey`).
 */
export type EmailConditionOp =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'exists'
  | 'truthy'
  | 'falsy'

export type EmailCondition = {
  path: string
  op: EmailConditionOp
  /** Compared value for eq / neq / contains. */
  value?: string | number | boolean | null
}

export type EmailConditionGroup = {
  /** All conditions must pass (AND). Empty = always true. */
  all?: EmailCondition[]
}

/**
 * Who receives the message. Static addresses and/or payload paths.
 * Paths resolve against the trigger payload (e.g. `respondentEmail`, `adminEmails`).
 */
export type EmailAudience = {
  /** Literal addresses. */
  to?: string[]
  /** Payload paths that resolve to a string or string[]. */
  toFromPayload?: string[]
  /** Optional CC literals. */
  cc?: string[]
  /** Optional Reply-To literal or payload path. */
  replyTo?: string
  replyToFromPayload?: string
}

export type EmailTemplateRecord = {
  id: string
  label: string
  moduleCategory: EmailModuleCategory
  subject: string
  bodyText: string
  bodyHtml: string
  createdAt: Date
  updatedAt: Date
}

export type EmailRuleRecord = {
  id: string
  label: string
  moduleCategory: EmailModuleCategory
  enabled: boolean
  /** Stable trigger key, e.g. `product:forms/submitted`. */
  triggerKey: string
  mode: EmailRuleMode
  conditions: EmailConditionGroup
  audience: EmailAudience
  templateId: string
  /** Optional From override (never a secret — address only). */
  fromOverride: string
  createdAt: Date
  updatedAt: Date
}

export type EmailTriggerDef = {
  /** Stable key modules emit (`product:forms/submitted`). */
  key: string
  label: string
  moduleCategory: EmailModuleCategory
  /** Module id that owns the emit (for docs / filter). */
  moduleId: string
  description: string
  /** Documented payload field names for admin merge help. */
  payloadFields: string[]
}

export type EmailTriggerEmitInput = {
  triggerKey: string
  /** Arbitrary JSON-ish payload for conditions + merge fields. */
  payload: Record<string, unknown>
  /** Optional From override for this emit. */
  from?: string
}

export type EmailTriggerEmitResult = {
  attempted: boolean
  skipped?: boolean
  reason?: string
  triggerKey: string
  matchedRuleIds: string[]
  results: Array<{
    ruleId: string
    ok: boolean
    skipped?: boolean
    error?: string
    provider?: string
  }>
}

export type EmailAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  id?: string
}
