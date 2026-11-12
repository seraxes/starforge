/** Built-in entitlement keys this pack ships. */
export const ENTITLEMENT_KEYS = {
  eventsMember: 'events.member',
  eventsManage: 'events.manage',
  paymentsCollect: 'payments.collect',
} as const

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS]

/**
 * Known plan subjects — open string for later kinds.
 * `other` is the catch-all bucket (custom subjects land there in admin filters).
 */
export const PLAN_SUBJECTS = {
  membership: 'membership',
  organizer: 'organizer',
  advertisement: 'advertisement',
  other: 'other',
} as const

export type PlanSubject = string

export const PLAN_BILLING_PERIODS = ['day', 'week', 'month', 'year', 'lifetime'] as const
export type PlanBillingPeriod = (typeof PLAN_BILLING_PERIODS)[number]

export function isPlanBillingPeriod(value: unknown): value is PlanBillingPeriod {
  return (
    value === 'day' ||
    value === 'week' ||
    value === 'month' ||
    value === 'year' ||
    value === 'lifetime'
  )
}

export const PERIOD_STATUSES = ['active', 'expired', 'refunded'] as const
export type PeriodStatus = (typeof PERIOD_STATUSES)[number]

export const CHECKOUT_MODES = ['subscribe', 'renew', 'upgrade'] as const
export type CheckoutMode = (typeof CHECKOUT_MODES)[number]

export function isCheckoutMode(value: unknown): value is CheckoutMode {
  return value === 'subscribe' || value === 'renew' || value === 'upgrade'
}

/** Far-future sentinel for lifetime periods (UTC). */
export const LIFETIME_ENDS_AT = new Date('9999-12-31T23:59:59.999Z')

export type SubscriptionPlanRecord = {
  id: string
  subject: string
  audience: string
  title: string
  description: string
  price: number
  billingPeriod: PlanBillingPeriod
  entitlementKeys: string[]
  groupIds: string[]
  sourceModule: string
  sourceType: string
  sourceId: string
  active: boolean
  sortOrder: number
  trialDurationDays: number
  trialPrice: number
  trialOnce: boolean
  lifetime: boolean
  fixedExpiresAt: Date | null
  maxActive: number
  formDefinitionId: string
  earlyRenewDays: number
  earlyRenewPrice: number | null
  upgradeTargetIds: string[]
  graceHours: number
  seatLimit: number
  recurringSupported: boolean
  imageMediaId: string
  createdAt: Date
  updatedAt: Date
}

export type SubscriptionPeriodRecord = {
  id: string
  planId: string
  userId: string
  status: PeriodStatus
  startsAt: Date
  endsAt: Date
  orderId: string | null
  subject: string
  audience: string
  billingPeriod: PlanBillingPeriod
  entitlementKeys: string[]
  groupIds: string[]
  sourceModule: string
  sourceType: string
  sourceId: string
  source: string
  cancelAtPeriodEnd: boolean
  autoRenew: boolean
  paymentsRecurringId: string | null
  isTrial: boolean
  parentPeriodId: string | null
  seatRole: string
  reminderExpiringSentAt: Date | null
  reminderTrialSentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type SubscriptionSeatRecord = {
  id: string
  periodId: string
  userId: string
  role: 'admin' | 'member'
  createdAt: Date
}

export type AudienceResolve = {
  entitlementKeys: string[]
  groupIds: string[]
  periodIds: string[]
}

/** Default keys when admin leaves the list empty for a known subject. */
export function defaultEntitlementKeysForSubject(subject: string): string[] {
  if (subject === PLAN_SUBJECTS.membership) return [ENTITLEMENT_KEYS.eventsMember]
  if (subject === PLAN_SUBJECTS.organizer) {
    return [ENTITLEMENT_KEYS.eventsManage, ENTITLEMENT_KEYS.paymentsCollect]
  }
  return []
}

/** Pack settings in `sf_module_settings` (id = product:subscriptions). */
export type SubscriptionsModuleSettings = {
  /** Days before endsAt to emit expiring_soon. */
  reminderDays: number
  /** Days before trial endsAt to emit trial_ending. */
  trialReminderDays: number
  /** Default grace hours applied when a plan leaves grace at 0 and this is > 0 — informational default for new plans. */
  defaultGraceHours: number
  /** Default Forms definition id suggested on new plans. */
  defaultFormDefinitionId: string
}

export const DEFAULT_SUBSCRIPTIONS_MODULE_SETTINGS: SubscriptionsModuleSettings = {
  reminderDays: 7,
  trialReminderDays: 3,
  defaultGraceHours: 0,
  defaultFormDefinitionId: 'subscription-registration',
}
