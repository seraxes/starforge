/**
 * Expire lapsed subscription periods via JobRunner.
 */

import 'server-only'

import { getJobRunner, registerJobHandler } from '@/core/jobs'

import { emitSubscriptionsEmail } from './email'
import { expireLapsedPeriods } from './store'

export const SUBSCRIPTIONS_EXPIRY_JOB = 'subscriptions.expire-periods' as const
export const SUBSCRIPTIONS_EXPIRY_SWEEP_MS = 60_000

type SweepGlobal = typeof globalThis & {
  __sfSubscriptionsExpirySweep?: boolean
}

export async function sweepExpiredSubscriptionPeriods(
  now = new Date(),
): Promise<{ expired: number }> {
  const expired = await expireLapsedPeriods(now)
  if (expired > 0) {
    await emitSubscriptionsEmail('product:subscriptions/expired', {
      reason: 'period_ended',
      endedCount: expired,
      at: now.toISOString(),
    })
  }
  return { expired }
}

export function ensureSubscriptionsExpiryJob(): void {
  registerJobHandler(SUBSCRIPTIONS_EXPIRY_JOB, async () => {
    await sweepExpiredSubscriptionPeriods()
  })

  const g = globalThis as SweepGlobal
  if (g.__sfSubscriptionsExpirySweep) return
  g.__sfSubscriptionsExpirySweep = true

  const runner = getJobRunner()
  void runner.enqueue({
    name: SUBSCRIPTIONS_EXPIRY_JOB,
    payload: {},
    runAt: new Date(),
  })

  setInterval(() => {
    void runner.enqueue({
      name: SUBSCRIPTIONS_EXPIRY_JOB,
      payload: {},
      runAt: new Date(),
    })
  }, SUBSCRIPTIONS_EXPIRY_SWEEP_MS)
}
