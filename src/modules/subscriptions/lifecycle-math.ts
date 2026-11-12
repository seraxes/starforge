/**
 * Pure period math — no DB / server-only (safe for unit tests).
 */

import {
  LIFETIME_ENDS_AT,
  type PlanBillingPeriod,
  type SubscriptionPeriodRecord,
  type SubscriptionPlanRecord,
} from './types'

export function addBillingPeriod(
  from: Date,
  period: PlanBillingPeriod,
  opts?: { lifetime?: boolean; fixedExpiresAt?: Date | null; trialDays?: number },
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
  const next = new Date(from.getTime())
  if (period === 'day') {
    next.setUTCDate(next.getUTCDate() + 1)
  } else if (period === 'week') {
    next.setUTCDate(next.getUTCDate() + 7)
  } else if (period === 'year') {
    next.setUTCFullYear(next.getUTCFullYear() + 1)
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1)
  }
  return next
}

/** Walk one billing period backward from `from` (lifetime unchanged). */
export function subtractBillingPeriod(from: Date, period: PlanBillingPeriod): Date {
  if (period === 'lifetime') return new Date(from.getTime())
  const next = new Date(from.getTime())
  if (period === 'day') {
    next.setUTCDate(next.getUTCDate() - 1)
  } else if (period === 'week') {
    next.setUTCDate(next.getUTCDate() - 7)
  } else if (period === 'year') {
    next.setUTCFullYear(next.getUTCFullYear() - 1)
  } else {
    next.setUTCMonth(next.getUTCMonth() - 1)
  }
  return next
}

/** Nominal length of one billing period starting at `from`. */
export function billingPeriodDurationMs(period: PlanBillingPeriod, from = new Date()): number {
  if (period === 'lifetime') return 0
  return addBillingPeriod(from, period).getTime() - from.getTime()
}

/** Effective end for resolve — grace hours keep access after endsAt. */
export function periodEffectiveEnd(period: SubscriptionPeriodRecord, graceHours: number): Date {
  if (graceHours <= 0) return period.endsAt
  return new Date(period.endsAt.getTime() + graceHours * 60 * 60 * 1000)
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
  const onePeriodMs = billingPeriodDurationMs(period, now)
  if (onePeriodMs <= 0) return 0
  const remainingMs = Math.max(0, fromPeriod.endsAt.getTime() - now.getTime())
  const fraction = Math.min(1, remainingMs / onePeriodMs)
  return Math.floor(fromPlan.price * fraction)
}
