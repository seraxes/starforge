/**
 * Release ticket seats stuck in `pending_payment` after an online checkout
 * never receives a provider webhook. Offline methods stay until staff mark paid.
 */

import 'server-only'

import { and, asc, eq, gt } from 'drizzle-orm'

import { db } from '@/core/db'
import { getJobRunner, registerJobHandler } from '@/core/jobs'

import { abandonedHoldAction } from './abandoned-checkout-rules'
import {
  applyEventsPaymentResult,
  ensureEventsPaymentHookReady,
} from './payment-bridge'
import { sfEventRegistrations } from './schema'
import {
  EVENTS_ABANDONED_CHECKOUT_JOB,
  EVENTS_ABANDONED_CHECKOUT_SWEEP_MS,
} from './triggers'

const SWEEP_BATCH = 200

type SweepGlobal = typeof globalThis & {
  __sfEventsAbandonedCheckoutSweep?: boolean
}

export async function sweepAbandonedTicketHolds(
  now = new Date(),
): Promise<{ expiredOrders: number; releasedHolds: number }> {
  await ensureEventsPaymentHookReady()

  let ttlMinutes = 60
  let expiredOrders = 0
  let paymentsReady = false

  try {
    const payments = await import('@/modules/payments/api')
    const settings = await payments.getPaymentsSettings()
    ttlMinutes = settings.checkoutTtlMinutes || 60
    const expired = await payments.expireAbandonedOnlineCheckouts(now)
    expiredOrders = expired.expired
    paymentsReady = true
  } catch (error) {
    console.error('[events] abandoned checkout sweep could not read Payments', error)
  }

  let releasedHolds = 0
  let afterId = ''

  for (let page = 0; page < 25; page += 1) {
    let holds: Array<{
      id: string
      paymentOrderId: string | null
      updatedAt: Date
    }>
    try {
      holds = await db
        .select({
          id: sfEventRegistrations.id,
          paymentOrderId: sfEventRegistrations.paymentOrderId,
          updatedAt: sfEventRegistrations.updatedAt,
        })
        .from(sfEventRegistrations)
        .where(
          afterId
            ? and(
                eq(sfEventRegistrations.status, 'pending_payment'),
                gt(sfEventRegistrations.id, afterId),
              )
            : eq(sfEventRegistrations.status, 'pending_payment'),
        )
        .orderBy(asc(sfEventRegistrations.id))
        .limit(SWEEP_BATCH)
    } catch (error) {
      console.error('[events] abandoned checkout sweep could not read holds', error)
      break
    }
    if (holds.length === 0) break
    afterId = holds[holds.length - 1]?.id || afterId

    const orderIds = holds
      .map((hold) => (hold.paymentOrderId || '').trim())
      .filter(Boolean)

    let states = new Map<string, { status: string }>()
    let pageReady = paymentsReady
    if (pageReady) {
      try {
        const payments = await import('@/modules/payments/api')
        states = await payments.getOrderCheckoutStates(orderIds)
      } catch (error) {
        console.error('[events] abandoned checkout sweep could not read orders', error)
        pageReady = false
      }
    }

    for (const hold of holds) {
      const orderId = (hold.paymentOrderId || '').trim()
      const order = !orderId
        ? null
        : pageReady
          ? (states.get(orderId) ?? null)
          : { status: 'unknown' }
      if (
        abandonedHoldAction({
          paymentOrderId: orderId,
          updatedAt: hold.updatedAt,
          order,
          ttlMinutes,
          now,
        }) !== 'release'
      ) {
        continue
      }
      await applyEventsPaymentResult(hold.id, 'expired')
      releasedHolds += 1
    }

    if (holds.length < SWEEP_BATCH) break
  }

  return { expiredOrders, releasedHolds }
}

async function enqueueAbandonedCheckoutSweep(delayMs: number): Promise<boolean> {
  const runAt = Date.now() + delayMs
  try {
    const result = await getJobRunner().enqueue({
      name: EVENTS_ABANDONED_CHECKOUT_JOB,
      runAt,
      idempotencyKey: `${EVENTS_ABANDONED_CHECKOUT_JOB}:${Math.floor(runAt / EVENTS_ABANDONED_CHECKOUT_SWEEP_MS)}`,
    })
    return result.ok
  } catch (error) {
    console.error('[events] abandoned checkout sweep schedule failed', error)
    return false
  }
}

/** Arm a self-rescheduling sweep. Safe to call more than once. */
export function ensureAbandonedCheckoutSweep(): void {
  registerJobHandler(EVENTS_ABANDONED_CHECKOUT_JOB, async () => {
    try {
      await sweepAbandonedTicketHolds()
    } finally {
      await enqueueAbandonedCheckoutSweep(EVENTS_ABANDONED_CHECKOUT_SWEEP_MS)
    }
  })

  const g = globalThis as SweepGlobal
  if (g.__sfEventsAbandonedCheckoutSweep) return
  g.__sfEventsAbandonedCheckoutSweep = true
  void enqueueAbandonedCheckoutSweep(0).then((ok) => {
    if (!ok) g.__sfEventsAbandonedCheckoutSweep = false
  })
}
