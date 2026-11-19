/**
 * Subscriptions ↔ product:payments bridge.
 * Payments owns checkout; this pack owns periods / entitlements.
 */

import 'server-only'

import { getLocale } from 'next-intl/server'

import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import { majorToMinor } from '@/core/payments'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { emitSubscriptionsEmail } from './email'
import { classifyPlanChange, upgradeChargeMajor } from './lifecycle-math'
import {
  activateOrExtendPeriod,
  computeUpgradeCreditMajor,
  countActivePeriodsForPlan,
  endPeriodsForOrder,
  findPendingSchedule,
  findPlanById,
  findUpgradePath,
  hasEntitlement,
  listActivePeriodsForUser,
  loadPlanHoldNotices,
  resolveCheckoutPriceMajor,
  scheduleDowngrade,
  userHasUsedTrial,
} from './store'
import {
  ENTITLEMENT_KEYS,
  isCheckoutMode,
  isPlanBillingPeriod,
  type CheckoutMode,
  type PlanBillingPeriod,
} from './types'
import { loadSubscriberEmail } from './user-email'

export const SUBSCRIPTIONS_PAYMENT_HOOK = 'subscriptions.activate' as const

let hookReady: Promise<void> | null = null

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => String(v ?? '').trim()).filter(Boolean)
}

export async function applySubscriptionsPaymentResult(
  orderId: string,
  status: 'paid' | 'expired' | 'failed' | 'refunded',
  lines: Array<{
    sourceModule: string
    sourceType: string
    sourceId: string
    qty: number
    billingPeriod?: string | null
    metadata: Record<string, unknown>
  }>,
  metadata: Record<string, unknown>,
): Promise<void> {
  const id = orderId.trim()
  if (!id) return

  if (status === 'paid') {
    for (const line of lines) {
      if (line.sourceModule !== 'product:subscriptions' || line.sourceType !== 'plan') continue
      const planId = line.sourceId.trim()
      if (!planId) continue
      const userId = String(
        line.metadata.userId ?? metadata.userId ?? metadata.buyerUserId ?? '',
      ).trim()
      if (!userId) continue

      const billingPeriodRaw = line.billingPeriod || line.metadata.billingPeriod
      const billingPeriod: PlanBillingPeriod | undefined = isPlanBillingPeriod(billingPeriodRaw)
        ? billingPeriodRaw
        : undefined
      const billingIntervalCountRaw = line.metadata.billingIntervalCount
      const billingIntervalCount =
        billingIntervalCountRaw == null || billingIntervalCountRaw === ''
          ? undefined
          : Number(billingIntervalCountRaw)

      const mode = String(line.metadata.mode ?? metadata.mode ?? 'subscribe').trim()
      const isTrial = line.metadata.isTrial === true || line.metadata.isTrial === 'true'
      const exclusiveSubject = mode === 'upgrade'
      const autoRenew = line.metadata.autoRenew === true || line.metadata.autoRenew === 'true'
      const paymentsRecurringId = String(line.metadata.paymentsRecurringId ?? '').trim() || null
      const fromPeriodId = String(line.metadata.fromPeriodId ?? '').trim()
      const clearSchedulePeriodId = String(line.metadata.clearSchedulePeriodId ?? '').trim()
      const startsAtRaw = String(line.metadata.startsAt ?? '').trim()
      const startsAt = startsAtRaw ? new Date(startsAtRaw) : null

      const result = await activateOrExtendPeriod({
        planId,
        userId,
        orderId: id,
        source: mode === 'upgrade' ? 'upgrade' : isTrial ? 'trial' : 'purchase',
        endPeriodId: mode === 'upgrade' ? fromPeriodId : null,
        startsAt: startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : null,
        clearSchedulePeriodId: clearSchedulePeriodId || null,
        subject: String(line.metadata.subject ?? '').trim() || undefined,
        audience: String(line.metadata.audience ?? '').trim() || undefined,
        billingPeriod,
        billingIntervalCount:
          billingIntervalCount != null && Number.isFinite(billingIntervalCount)
            ? billingIntervalCount
            : undefined,
        entitlementKeys: asStringList(line.metadata.entitlementKeys),
        groupIds: asStringList(line.metadata.groupIds),
        sourceModule: String(line.metadata.sourceModule ?? '').trim() || undefined,
        sourceType: String(line.metadata.sourceType ?? '').trim() || undefined,
        sourceId: String(line.metadata.sourceId ?? '').trim() || undefined,
        isTrial,
        exclusiveSubject,
        autoRenew,
        paymentsRecurringId,
      })

      if (result.ok) {
        const buyerEmail =
          String(metadata.buyerEmail ?? '').trim() || (await loadSubscriberEmail(userId))
        const trigger =
          mode === 'upgrade'
            ? 'product:subscriptions/upgraded'
            : mode === 'renew'
              ? 'product:subscriptions/renewed'
              : 'product:subscriptions/activated'
        if (buyerEmail) {
          await emitSubscriptionsEmail(trigger, {
            orderId: id,
            periodId: result.period.id,
            planId,
            userId,
            buyerEmail,
            subject: result.period.subject,
            endsAt: result.period.endsAt.toISOString(),
            entitlementKeys: result.period.entitlementKeys,
            mode,
            isTrial: result.period.isTrial,
          })
        }
      }
    }
    return
  }

  if (status === 'expired' || status === 'failed' || status === 'refunded') {
    const endStatus = status === 'refunded' ? 'refunded' : 'expired'
    const ended = await endPeriodsForOrder(id, endStatus)
    for (const period of ended) {
      const buyerEmail = await loadSubscriberEmail(period.userId)
      if (!buyerEmail) continue
      await emitSubscriptionsEmail('product:subscriptions/expired', {
        orderId: id,
        periodId: period.id,
        planId: period.planId,
        userId: period.userId,
        buyerEmail,
        status: endStatus,
        reason: status,
        endsAt: period.endsAt.toISOString(),
      })
    }
  }
}

export function ensureSubscriptionsPaymentHookReady(): Promise<void> {
  if (!hookReady) {
    hookReady = import('@/modules/payments/api')
      .then(({ registerPaymentConsumerHook, registerCollectCapabilityResolver }) => {
        registerPaymentConsumerHook(SUBSCRIPTIONS_PAYMENT_HOOK, async (ctx) => {
          await applySubscriptionsPaymentResult(
            ctx.orderId,
            ctx.status,
            ctx.lines,
            ctx.metadata,
          )
        })
        // Payments never imports Subscriptions — live collect gate is registered here.
        registerCollectCapabilityResolver((userId) =>
          hasEntitlement(userId, ENTITLEMENT_KEYS.paymentsCollect),
        )
      })
      .catch((error) => {
        console.error('[subscriptions] payment hook register failed', error)
        hookReady = null
      })
  }
  return hookReady ?? Promise.resolve()
}

export function ensureSubscriptionsPaymentHook(): void {
  void ensureSubscriptionsPaymentHookReady()
  void import('./email-starters').then((m) => m.ensureSubscriptionsEmailStartersSeeded())
}

export type StartSubscriptionCheckoutInput = {
  planId: string
  userId: string
  buyerEmail: string
  buyerName?: string
  method: string
  couponCode?: string | null
  returnUrl?: string
  cancelUrl?: string
  mode?: CheckoutMode
  /** Required when mode is upgrade. */
  fromPeriodId?: string | null
  /** Opt into Payments recurring when plan supports it. */
  autoRenew?: boolean
}

export type StartSubscriptionCheckoutResult =
  | { ok: true; orderId: string; redirectPath: string; redirectUrl?: string }
  | { ok: false; error: string }
  | { ok: true; free: true; periodId: string; scheduled?: boolean }

export async function startSubscriptionCheckout(
  input: StartSubscriptionCheckoutInput,
): Promise<StartSubscriptionCheckoutResult> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
    return { ok: false, error: 'Subscriptions is disabled.' }
  }

  let plan = await findPlanById(input.planId)
  if (!plan || !plan.active) return { ok: false, error: 'Plan not found or inactive.' }

  const userId = input.userId.trim()
  const email = input.buyerEmail.trim()
  if (!userId || !email) return { ok: false, error: 'Buyer required.' }

  let mode: CheckoutMode = isCheckoutMode(input.mode) ? input.mode : 'subscribe'
  let deferredStart: Date | null = null
  let clearSchedulePeriodId = ''
  let upgradeCreditMode: 'prorate' | 'full' = 'prorate'
  let upgradeFromPeriod: Awaited<ReturnType<typeof listActivePeriodsForUser>>[number] | null = null
  let upgradeFromPlan: Awaited<ReturnType<typeof findPlanById>> = null

  let locale: AppLocale = DEFAULT_LOCALE
  try {
    const loc = await getLocale()
    if (isAppLocale(loc)) locale = loc
  } catch {
    /* default */
  }

  if (mode === 'subscribe' || mode === 'renew') {
    const pending = await findPendingSchedule(userId, plan.id)
    if (pending && (plan.id === pending.fromPlanId || plan.id === pending.toPlanId)) {
      const nextPlan = await findPlanById(pending.toPlanId)
      const fromPlan = await findPlanById(pending.fromPlanId)
      if (!nextPlan || !nextPlan.active || !fromPlan) {
        return { ok: false, error: 'The scheduled plan is no longer available.' }
      }
      if (pending.endsAt.getTime() > Date.now()) {
        const { describeSamePlanHold, planCanRenew, samePlanHoldMessage, formatRenewsOn } =
          await import('./lifecycle-math')
        const hold = describeSamePlanHold({
          now: new Date(),
          endsAt: pending.endsAt,
          earlyRenewDays: fromPlan.earlyRenewDays,
          renewable: planCanRenew(fromPlan),
        })
        if (!hold.allowed) {
          const label = hold.renewsAt ? formatRenewsOn(hold.renewsAt, locale) : ''
          return { ok: false, error: samePlanHoldMessage(hold, label) || 'This plan cannot be renewed yet.' }
        }
      }
      plan = nextPlan
      mode = 'renew'
      deferredStart = pending.endsAt.getTime() > Date.now() ? pending.endsAt : null
      clearSchedulePeriodId = pending.periodId
    } else {
      const holds = await loadPlanHoldNotices(userId, locale)
      const hold = holds[plan.id]
      if (hold) {
        if (!hold.allowed) {
          return { ok: false, error: hold.message || 'This plan cannot be renewed yet.' }
        }
        mode = 'renew'
      }
    }
  }

  if (plan.maxActive > 0 && mode === 'subscribe') {
    const n = await countActivePeriodsForPlan(plan.id)
    if (n >= plan.maxActive) return { ok: false, error: 'Plan is at capacity.' }
  }

  if (mode === 'renew') {
    if (plan.lifetime || plan.billingPeriod === 'lifetime' || plan.fixedExpiresAt) {
      return { ok: false, error: 'Lifetime and fixed-end plans cannot be renewed.' }
    }
  }

  if (mode === 'upgrade' || mode === 'downgrade') {
    const fromPeriodId = (input.fromPeriodId || '').trim()
    if (!fromPeriodId) return { ok: false, error: 'A plan change requires the current period.' }
    const active = await listActivePeriodsForUser(userId)
    const from = active.find((p) => p.id === fromPeriodId)
    if (!from) return { ok: false, error: 'Current subscription not found.' }
    if (from.planId === plan.id) {
      return { ok: false, error: 'Choose a different plan.' }
    }
    const fromPlan = await findPlanById(from.planId)
    if (!fromPlan) return { ok: false, error: 'Current plan not found.' }
    const path = await findUpgradePath(from.planId, plan.id)
    if (!path) return { ok: false, error: 'This plan change is not allowed.' }
    if (classifyPlanChange(fromPlan.price, plan.price) === 'downgrade') {
      const scheduled = await scheduleDowngrade({
        periodId: from.id,
        userId,
        toPlanId: plan.id,
      })
      if (!scheduled.ok) return { ok: false, error: scheduled.error }
      return { ok: true, free: true, periodId: from.id, scheduled: true }
    }
    mode = 'upgrade'
    upgradeCreditMode = path.creditMode
    upgradeFromPeriod = from
    upgradeFromPlan = fromPlan
  }

  const priced = await resolveCheckoutPriceMajor({ plan, userId, mode })

  if (clearSchedulePeriodId && priced.priceMajor <= 0) {
    const result = await activateOrExtendPeriod({
      planId: plan.id,
      userId,
      source: 'purchase',
      startsAt: deferredStart,
      clearSchedulePeriodId,
      isTrial: false,
    })
    if (!result.ok) return { ok: false, error: result.error }
    await emitSubscriptionsEmail('product:subscriptions/renewed', {
      periodId: result.period.id,
      planId: plan.id,
      userId,
      buyerEmail: email,
      subject: result.period.subject,
      endsAt: result.period.endsAt.toISOString(),
      mode: 'renew',
    })
    return { ok: true, free: true, periodId: result.period.id }
  }

  // Free path — no Payments cart (plan locks this).
  if (priced.priceMajor <= 0) {
    if (priced.isTrial && plan.trialOnce && (await userHasUsedTrial(userId, plan.id))) {
      return { ok: false, error: 'Trial already used.' }
    }
    const { activateFreePlan } = await import('./store')
    const free = await activateFreePlan({ planId: plan.id, userId })
    if (!free.ok) return { ok: false, error: free.error }
    await emitSubscriptionsEmail(
      priced.isTrial ? 'product:subscriptions/activated' : 'product:subscriptions/activated',
      {
        periodId: free.period.id,
        planId: plan.id,
        userId,
        buyerEmail: email,
        subject: free.period.subject,
        endsAt: free.period.endsAt.toISOString(),
        entitlementKeys: free.period.entitlementKeys,
        mode,
        isTrial: free.period.isTrial,
        source: free.period.source,
      },
    )
    return { ok: true, free: true, periodId: free.period.id }
  }

  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    return { ok: false, error: 'Payments is disabled.' }
  }

  ensureSubscriptionsPaymentHook()

  const payments = await import('@/modules/payments/api')
  const paySettings = await payments.getPaymentsSettings()
  const currency = paySettings.currency || 'HUF'

  let chargeMajor = priced.priceMajor
  if (mode === 'upgrade' && upgradeFromPeriod && upgradeFromPlan) {
    const credit =
      upgradeCreditMode === 'prorate'
        ? computeUpgradeCreditMajor(upgradeFromPeriod, upgradeFromPlan)
        : 0
    chargeMajor = upgradeChargeMajor(plan.price, upgradeCreditMode, credit)
  }

  if (chargeMajor <= 0 && mode === 'upgrade') {
    const result = await activateOrExtendPeriod({
      planId: plan.id,
      userId,
      source: 'upgrade',
      exclusiveSubject: true,
      endPeriodId: input.fromPeriodId,
      isTrial: false,
    })
    if (!result.ok) return { ok: false, error: result.error }
    await emitSubscriptionsEmail('product:subscriptions/upgraded', {
      periodId: result.period.id,
      planId: plan.id,
      userId,
      buyerEmail: email,
      subject: result.period.subject,
      endsAt: result.period.endsAt.toISOString(),
      mode: 'upgrade',
    })
    return { ok: true, free: true, periodId: result.period.id }
  }

  const unitAmountMinor = majorToMinor(chargeMajor, currency)
  if (unitAmountMinor == null || unitAmountMinor <= 0) {
    return { ok: false, error: 'Could not convert plan price.' }
  }

  const checkoutBase = withLocalePrefix(locale, `/checkout`)
  const returnUrl = input.returnUrl?.trim() || withLocalePrefix(locale, '/account/subscriptions')
  const cancelUrl = input.cancelUrl?.trim() || returnUrl

  const wantAutoRenew = Boolean(input.autoRenew && plan.recurringSupported)
  let paymentsRecurringId: string | null = null
  if (wantAutoRenew) {
    try {
      const recurring = await payments.createRecurring({
        userId,
        method: input.method,
        sourceModule: 'product:subscriptions',
        sourceType: 'plan',
        sourceId: plan.id,
        metadata: {
          planId: plan.id,
          billingPeriod: plan.billingPeriod,
          billingIntervalCount: plan.billingIntervalCount,
        },
      })
      if (recurring.ok) paymentsRecurringId = recurring.id
    } catch {
      /* recurring optional until Payments adapters mature */
    }
  }

  const cartId = await payments.createCart({ userId })
  await payments.addCartLine(cartId, {
    ...payments.PAYMENT_SOURCE_TYPES.subscriptionsPlan,
    sourceId: plan.id,
    title: plan.title,
    unitAmountMinor,
    billingPeriod: plan.billingPeriod === 'lifetime' ? 'year' : plan.billingPeriod,
    metadata: {
      userId,
      subject: plan.subject,
      audience: plan.audience,
      billingPeriod: plan.billingPeriod,
      billingIntervalCount: plan.billingIntervalCount,
      entitlementKeys: plan.entitlementKeys,
      groupIds: plan.groupIds,
      sourceModule: plan.sourceModule,
      sourceType: plan.sourceType,
      sourceId: plan.sourceId,
      mode,
      isTrial: priced.isTrial,
      fromPeriodId: input.fromPeriodId ?? '',
      clearSchedulePeriodId,
      startsAt: deferredStart ? deferredStart.toISOString() : '',
      autoRenew: wantAutoRenew,
      paymentsRecurringId: paymentsRecurringId ?? '',
    },
  })

  const idempotencyKey = `sub_${plan.id}_${userId}_${mode}_${Date.now()}`
  const started = await payments.startCheckout({
    cartId,
    method: input.method as never,
    buyer: {
      email,
      name: input.buyerName,
      userId,
    },
    idempotencyKey,
    returnUrl,
    cancelUrl,
    consumerHook: SUBSCRIPTIONS_PAYMENT_HOOK,
    couponCode: input.couponCode,
    metadata: {
      userId,
      planId: plan.id,
      subject: plan.subject,
      mode,
      buyerEmail: email,
    },
  })

  if (!started.ok) return { ok: false, error: started.error }

  const redirectPath = `${checkoutBase}/${started.orderId}`
  return {
    ok: true,
    orderId: started.orderId,
    redirectPath,
    redirectUrl: started.redirectUrl,
  }
}
