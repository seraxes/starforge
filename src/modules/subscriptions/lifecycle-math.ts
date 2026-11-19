/**
 * Pure period math — no DB / server-only (safe for unit tests).
 */

import {
  LIFETIME_ENDS_AT,
  normalizeBillingIntervalCount,
  type PlanBillingPeriod,
  type SubscriptionPeriodRecord,
  type SubscriptionPlanRecord,
} from './types'

export function addBillingPeriod(
  from: Date,
  period: PlanBillingPeriod,
  opts?: {
    lifetime?: boolean
    fixedExpiresAt?: Date | null
    trialDays?: number
    /** How many day/week/month/year units to add (default 1). */
    count?: number
  },
): Date {
  if (opts?.fixedExpiresAt && Number.isFinite(opts.fixedExpiresAt.getTime())) {
    return new Date(opts.fixedExpiresAt.getTime())
  }
  if (opts?.lifetime || period === 'lifetime') {
    return new Date(LIFETIME_ENDS_AT.getTime())
  }
  if (opts?.trialDays && opts.trialDays > 0) {
    const next = new Date(from.getTime())
    next.setUTCDate(next.getUTCDate() + opts.trialDays)
    return next
  }
  const count = normalizeBillingIntervalCount(opts?.count, 1)
  const next = new Date(from.getTime())
  if (period === 'day') {
    next.setUTCDate(next.getUTCDate() + count)
  } else if (period === 'week') {
    next.setUTCDate(next.getUTCDate() + 7 * count)
  } else if (period === 'year') {
    next.setUTCFullYear(next.getUTCFullYear() + count)
  } else {
    next.setUTCMonth(next.getUTCMonth() + count)
  }
  return next
}

/** Walk one billing interval backward from `from` (lifetime unchanged). */
export function subtractBillingPeriod(
  from: Date,
  period: PlanBillingPeriod,
  count: unknown = 1,
): Date {
  if (period === 'lifetime') return new Date(from.getTime())
  const n = normalizeBillingIntervalCount(count, 1)
  const next = new Date(from.getTime())
  if (period === 'day') {
    next.setUTCDate(next.getUTCDate() - n)
  } else if (period === 'week') {
    next.setUTCDate(next.getUTCDate() - 7 * n)
  } else if (period === 'year') {
    next.setUTCFullYear(next.getUTCFullYear() - n)
  } else {
    next.setUTCMonth(next.getUTCMonth() - n)
  }
  return next
}

/** Nominal length of one billing interval starting at `from`. */
export function billingPeriodDurationMs(
  period: PlanBillingPeriod,
  from = new Date(),
  count: unknown = 1,
): number {
  if (period === 'lifetime') return 0
  return addBillingPeriod(from, period, { count: normalizeBillingIntervalCount(count, 1) }).getTime() -
    from.getTime()
}

/** Effective end for resolve — grace hours keep access after endsAt. */
export function periodEffectiveEnd(period: SubscriptionPeriodRecord, graceHours: number): Date {
  if (graceHours <= 0) return period.endsAt
  return new Date(period.endsAt.getTime() + graceHours * 60 * 60 * 1000)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Lifetime and fixed-end plans do not renew. Early renew is a window, not a second term by default. */
export function planCanRenew(plan: {
  lifetime: boolean
  billingPeriod: string
  fixedExpiresAt: Date | null
}): boolean {
  if (plan.lifetime || plan.billingPeriod === 'lifetime') return false
  if (plan.fixedExpiresAt) return false
  return true
}

/** Whole days, then hours, then minutes. */
export function formatTimeLeft(remainingMs: number): string {
  if (remainingMs <= 0) return 'no time'
  const minute = 60 * 1000
  const hour = 60 * minute
  if (remainingMs >= DAY_MS) {
    const days = Math.floor(remainingMs / DAY_MS)
    return days === 1 ? '1 day' : `${days} days`
  }
  if (remainingMs >= hour) {
    const hours = Math.floor(remainingMs / hour)
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  const minutes = Math.max(1, Math.ceil(remainingMs / minute))
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

export type SamePlanHold = {
  /** Plan can be renewed at all. */
  renewable: boolean
  /** Buyer may start a renew checkout now. */
  allowed: boolean
  /** Inside the early-renew window, before endsAt. */
  early: boolean
  remainingMs: number
  timeLeftLabel: string
  /** When renew opens. Null when the plan cannot renew. */
  renewsAt: Date | null
}

/**
 * Same plan while a period is still active.
 * `earlyRenewDays` 0 keeps renew closed until `endsAt`.
 * A positive value opens renew that many days before `endsAt`.
 */
export function describeSamePlanHold(input: {
  now: Date
  endsAt: Date
  earlyRenewDays: number
  renewable: boolean
}): SamePlanHold {
  const remainingMs = Math.max(0, input.endsAt.getTime() - input.now.getTime())
  const timeLeftLabel = formatTimeLeft(remainingMs)
  if (!input.renewable) {
    return {
      renewable: false,
      allowed: false,
      early: false,
      remainingMs,
      timeLeftLabel,
      renewsAt: null,
    }
  }
  const days = Math.max(0, Math.floor(input.earlyRenewDays))
  const renewsAt =
    days > 0 ? new Date(input.endsAt.getTime() - days * DAY_MS) : new Date(input.endsAt.getTime())
  const allowed = input.now.getTime() >= renewsAt.getTime()
  const early = allowed && days > 0 && input.now.getTime() < input.endsAt.getTime()
  return {
    renewable: true,
    allowed,
    early,
    remainingMs,
    timeLeftLabel,
    renewsAt,
  }
}

export function formatRenewsOn(date: Date, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function samePlanHoldMessage(hold: SamePlanHold, renewsOnLabel: string): string {
  if (!hold.renewable) {
    return `You still have ${hold.timeLeftLabel} left. This plan does not renew.`
  }
  if (hold.allowed) return ''
  return `You still have ${hold.timeLeftLabel} left. You can renew on ${renewsOnLabel}.`
}

/** Early-renew price applies only inside a configured window. */
export function earlyRenewPriceApplies(input: {
  earlyRenewDays: number
  earlyRenewPrice: number | null
  daysLeft: number
}): boolean {
  if (input.earlyRenewPrice == null) return false
  if (input.earlyRenewDays <= 0) return false
  return input.daysLeft <= input.earlyRenewDays
}

export const CHANGE_CREDIT_MODES = ['prorate', 'full'] as const
export type ChangeCreditMode = (typeof CHANGE_CREDIT_MODES)[number]

export function isChangeCreditMode(value: unknown): value is ChangeCreditMode {
  return value === 'prorate' || value === 'full'
}

/** A higher price starts now. A lower or equal price waits for the next renewal. */
export function classifyPlanChange(
  fromPrice: number,
  toPrice: number,
): 'upgrade' | 'downgrade' {
  return toPrice > fromPrice ? 'upgrade' : 'downgrade'
}

/**
 * Amount due for an immediate upgrade.
 * `prorate` subtracts unused value. `full` charges the target price and drops that value.
 */
export function upgradeChargeMajor(
  targetPrice: number,
  creditMode: ChangeCreditMode,
  creditMajor: number,
): number {
  const price = Math.max(0, Math.floor(targetPrice))
  const credit = creditMode === 'full' ? 0 : Math.max(0, Math.floor(creditMajor))
  return Math.max(0, price - credit)
}

/** Unused-time credit major units when upgrading from an active period. */
export function computeUpgradeCreditMajor(
  fromPeriod: SubscriptionPeriodRecord,
  fromPlan: SubscriptionPlanRecord,
  now = new Date(),
): number {
  if (fromPlan.price <= 0) return 0
  if (fromPlan.lifetime || fromPeriod.billingPeriod === 'lifetime') return 0
  const period = fromPeriod.billingPeriod || fromPlan.billingPeriod
  const count =
    fromPeriod.billingIntervalCount || fromPlan.billingIntervalCount || 1
  const onePeriodMs = billingPeriodDurationMs(period, now, count)
  if (onePeriodMs <= 0) return 0
  const remainingMs = Math.max(0, fromPeriod.endsAt.getTime() - now.getTime())
  const fraction = Math.min(1, remainingMs / onePeriodMs)
  return Math.floor(fromPlan.price * fraction)
}
