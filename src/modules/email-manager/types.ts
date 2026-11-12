/**
 * Email Manager shared types (product:email-manager).
 * Transport stays Core Mailer — these shape rules, templates, and triggers only.
 */

/** Catalog / filter bucket shown in admin (Forms, Auth, Events, …). */
export const EMAIL_MODULE_CATEGORIES = [
  'forms',
  'auth',
  'events',
  'payments',
  'subscriptions',
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

/** Module settings document in `sf_module_settings` (id = product:email-manager). */
export type EmailManagerModuleSettings = {
  /** Recipients sent per drain slice. */
  broadcastBatchSize: number
  /** Minutes to wait between slices. */
  broadcastGapMinutes: number
}

export const EMAIL_BROADCAST_BATCH_MIN = 1
export const EMAIL_BROADCAST_BATCH_MAX = 50
export const EMAIL_BROADCAST_GAP_MIN = 1
export const EMAIL_BROADCAST_GAP_MAX = 120
/** Hard cap for one broadcast enqueue. */
export const EMAIL_BROADCAST_RECIPIENT_CAP = 2000

export const DEFAULT_EMAIL_MANAGER_MODULE_SETTINGS: EmailManagerModuleSettings = {
  broadcastBatchSize: 20,
  broadcastGapMinutes: 10,
}

export const EMAIL_BROADCAST_STATUSES = [
  'queued',
  'running',
  'paused',
  'done',
  'cancelled',
  'failed',
] as const

export type EmailBroadcastStatus = (typeof EMAIL_BROADCAST_STATUSES)[number]

export function isEmailBroadcastStatus(value: unknown): value is EmailBroadcastStatus {
  return (
    typeof value === 'string' &&
    (EMAIL_BROADCAST_STATUSES as readonly string[]).includes(value)
  )
}

export const EMAIL_BROADCAST_RECIPIENT_STATUSES = [
  'queued',
  'sending',
  'sent',
  'failed',
  'skipped',
] as const

export type EmailBroadcastRecipientStatus =
  (typeof EMAIL_BROADCAST_RECIPIENT_STATUSES)[number]

export function isEmailBroadcastRecipientStatus(
  value: unknown,
): value is EmailBroadcastRecipientStatus {
  return (
    typeof value === 'string' &&
    (EMAIL_BROADCAST_RECIPIENT_STATUSES as readonly string[]).includes(value)
  )
}

export type EmailBroadcastRecipientInput = {
  email: string
  /** Frozen merge fields for this recipient. */
  payload?: Record<string, unknown>
}

export type EmailBroadcastRecord = {
  id: string
  label: string
  templateId: string
  moduleCategory: EmailModuleCategory
  sourceKey: string
  status: EmailBroadcastStatus
  batchSize: number
  gapMinutes: number
  totalCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  nextRunAt: Date | null
  lastError: string
  createdAt: Date
  updatedAt: Date
}

export type EmailBroadcastEnqueueInput = {
  label: string
  templateId: string
  moduleCategory?: string
  /** Caller scope key, e.g. `events:<eventId>`. */
  sourceKey: string
  recipients: EmailBroadcastRecipientInput[]
  /** Optional From override (address only). */
  from?: string
}

export type EmailBroadcastEnqueueResult = {
  ok: boolean
  skipped?: boolean
  error?: string
  broadcastId?: string
  totalCount?: number
  batchSize?: number
  gapMinutes?: number
  /** True when an in-flight broadcast for the same sourceKey was returned. */
  alreadyRunning?: boolean
  message?: string
}
