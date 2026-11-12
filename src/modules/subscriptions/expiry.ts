/**
 * Expire lapsed subscription periods + send reminder triggers via JobRunner.
 * Self-rescheduling (Events abandoned-checkout pattern) — no process-local setInterval.
 */

import 'server-only'

import { getJobRunner, registerJobHandler } from '@/core/jobs'

import { emitSubscriptionsEmail } from './email'
import { ensureSubscriptionsEmailStartersSeeded } from './email-starters'
import { loadSubscriptionsModuleSettings } from './settings'
import {
  expireLapsedPeriods,
  listPeriodsExpiringSoon,
  listTrialsEndingSoon,
  markReminderSent,
} from './store'
import { loadSubscriberEmail } from './user-email'

export const SUBSCRIPTIONS_EXPIRY_JOB = 'subscriptions.expire-periods' as const
export const SUBSCRIPTIONS_EXPIRY_SWEEP_MS = 60_000
/** Fallback when settings cannot load. */
export const SUBSCRIPTIONS_REMINDER_DAYS = 7

type SweepGlobal = typeof globalThis & {
  __sfSubscriptionsExpirySweep?: boolean
}

async function emitPeriodEmail(
  triggerKey: string,
  period: {
    id: string
    planId: string
    userId: string
    subject: string
    endsAt: Date
    orderId: string | null
    isTrial?: boolean
  },
  extra?: Record<string, unknown>,
): Promise<void> {
  const buyerEmail = await loadSubscriberEmail(period.userId)
  if (!buyerEmail) return
  await emitSubscriptionsEmail(triggerKey, {
    orderId: period.orderId,
    periodId: period.id,
    planId: period.planId,
    userId: period.userId,
    buyerEmail,
    subject: period.subject,
    endsAt: period.endsAt.toISOString(),
    ...extra,
  })
}

export async function sweepExpiredSubscriptionPeriods(
  now = new Date(),
): Promise<{ expired: number; reminded: number; trialReminded: number }> {
  const ended = await expireLapsedPeriods(now)
  for (const period of ended) {
    await emitPeriodEmail('product:subscriptions/expired', period, {
      reason: 'period_ended',
      status: 'expired',
      at: now.toISOString(),
    })
  }

  let reminderDays = SUBSCRIPTIONS_REMINDER_DAYS
  let trialReminderDays = 3
  try {
    const loaded = await loadSubscriptionsModuleSettings()
    reminderDays = loaded.settings.reminderDays
    trialReminderDays = loaded.settings.trialReminderDays
  } catch {
    /* defaults */
  }

  let reminded = 0
  const expiring = await listPeriodsExpiringSoon(reminderDays, now)
  for (const period of expiring) {
    await emitPeriodEmail('product:subscriptions/expiring_soon', period, {
      withinDays: reminderDays,
    })
    await markReminderSent(period.id, 'expiring', now)
    reminded += 1
  }

  let trialReminded = 0
  const trials = await listTrialsEndingSoon(trialReminderDays, now)
  for (const period of trials) {
    await emitPeriodEmail('product:subscriptions/trial_ending', period, {
      withinDays: trialReminderDays,
    })
    await markReminderSent(period.id, 'trial', now)
    trialReminded += 1
  }

  return { expired: ended.length, reminded, trialReminded }
}

async function enqueueSubscriptionsExpirySweep(delayMs: number): Promise<boolean> {
  const runAt = Date.now() + Math.max(0, delayMs)
  try {
    const result = await getJobRunner().enqueue({
      name: SUBSCRIPTIONS_EXPIRY_JOB,
      runAt,
      idempotencyKey: `${SUBSCRIPTIONS_EXPIRY_JOB}:${Math.floor(runAt / SUBSCRIPTIONS_EXPIRY_SWEEP_MS)}`,
    })
    return result.ok
  } catch (error) {
    console.error('[subscriptions] expiry sweep schedule failed', error)
    return false
  }
}

/** Arm a self-rescheduling sweep. Safe to call more than once. */
export function ensureSubscriptionsExpiryJob(): void {
  registerJobHandler(SUBSCRIPTIONS_EXPIRY_JOB, async () => {
    try {
      await sweepExpiredSubscriptionPeriods()
    } finally {
      await enqueueSubscriptionsExpirySweep(SUBSCRIPTIONS_EXPIRY_SWEEP_MS)
    }
  })

  const g = globalThis as SweepGlobal
  if (g.__sfSubscriptionsExpirySweep) return
  g.__sfSubscriptionsExpirySweep = true
  void ensureSubscriptionsEmailStartersSeeded()
  void enqueueSubscriptionsExpirySweep(0).then((ok) => {
    if (!ok) g.__sfSubscriptionsExpirySweep = false
  })
}
