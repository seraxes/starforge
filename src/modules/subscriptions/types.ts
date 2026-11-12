/** Built-in entitlement keys this pack ships. */
export const ENTITLEMENT_KEYS = {
  eventsMember: 'events.member',
  eventsManage: 'events.manage',
  paymentsCollect: 'payments.collect',
} as const

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS]

/** Known plan subjects — open string for later kinds. */
export const PLAN_SUBJECTS = {
  membership: 'membership',
  organizer: 'organizer',
  advertisement: 'advertisement',
} as const

export type PlanSubject = string

export const PLAN_BILLING_PERIODS = ['month', 'year'] as const
export type PlanBillingPeriod = (typeof PLAN_BILLING_PERIODS)[number]

export function isPlanBillingPeriod(value: unknown): value is PlanBillingPeriod {
  return value === 'month' || value === 'year'
}

export const PERIOD_STATUSES = ['active', 'expired', 'refunded'] as const
export type PeriodStatus = (typeof PERIOD_STATUSES)[number]

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
  createdAt: Date
  updatedAt: Date
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
