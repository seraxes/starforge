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
import {
  activateOrExtendPeriod,
  endPeriodsForOrder,
  findPlanById,
} from './store'
import { isPlanBillingPeriod, type PlanBillingPeriod } from './types'

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

      const result = await activateOrExtendPeriod({
        planId,
        userId,
        orderId: id,
        source: 'purchase',
        subject: String(line.metadata.subject ?? '').trim() || undefined,
        audience: String(line.metadata.audience ?? '').trim() || undefined,
        billingPeriod,
        entitlementKeys: asStringList(line.metadata.entitlementKeys),
        groupIds: asStringList(line.metadata.groupIds),
        sourceModule: String(line.metadata.sourceModule ?? '').trim() || undefined,
        sourceType: String(line.metadata.sourceType ?? '').trim() || undefined,
        sourceId: String(line.metadata.sourceId ?? '').trim() || undefined,
      })

      if (result.ok) {
        await emitSubscriptionsEmail('product:subscriptions/activated', {
          orderId: id,
          periodId: result.period.id,
          planId,
          userId,
          subject: result.period.subject,
          endsAt: result.period.endsAt.toISOString(),
          entitlementKeys: result.period.entitlementKeys,
        })
      }
    }
    return
  }

  if (status === 'expired' || status === 'failed' || status === 'refunded') {
    const endStatus = status === 'refunded' ? 'refunded' : 'expired'
    const n = await endPeriodsForOrder(id, endStatus)
    if (n > 0) {
      await emitSubscriptionsEmail('product:subscriptions/expired', {
        orderId: id,
        status: endStatus,
        endedCount: n,
      })
    }
  }
}

export function ensureSubscriptionsPaymentHookReady(): Promise<void> {
  if (!hookReady) {
    hookReady = import('@/modules/payments/api')
      .then(({ registerPaymentConsumerHook }) => {
        registerPaymentConsumerHook(SUBSCRIPTIONS_PAYMENT_HOOK, async (ctx) => {
          await applySubscriptionsPaymentResult(
            ctx.orderId,
            ctx.status,
            ctx.lines,
            ctx.metadata,
          )
        })
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
}

export type StartSubscriptionCheckoutResult =
  | { ok: true; orderId: string; redirectPath: string; redirectUrl?: string }
  | { ok: false; error: string }

export async function startSubscriptionCheckout(
  input: StartSubscriptionCheckoutInput,
): Promise<StartSubscriptionCheckoutResult> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
    return { ok: false, error: 'Subscriptions is disabled.' }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    return { ok: false, error: 'Payments is disabled.' }
  }

  const plan = await findPlanById(input.planId)
  if (!plan || !plan.active) return { ok: false, error: 'Plan not found or inactive.' }
  if (plan.price <= 0) return { ok: false, error: 'Plan has no price.' }

  const userId = input.userId.trim()
  const email = input.buyerEmail.trim()
  if (!userId || !email) return { ok: false, error: 'Buyer required.' }

  ensureSubscriptionsPaymentHook()

  const payments = await import('@/modules/payments/api')
  const paySettings = await payments.getPaymentsSettings()
  const currency = paySettings.currency || 'HUF'
  const unitAmountMinor = majorToMinor(plan.price, currency)
  if (unitAmountMinor == null || unitAmountMinor <= 0) {
    return { ok: false, error: 'Could not convert plan price.' }
  }

  let locale: AppLocale = DEFAULT_LOCALE
  try {
    const loc = await getLocale()
    if (isAppLocale(loc)) locale = loc
  } catch {
    /* default */
  }

  const checkoutBase = withLocalePrefix(locale, `/checkout`)
  const returnUrl = input.returnUrl?.trim() || withLocalePrefix(locale, '/account/subscriptions')
  const cancelUrl = input.cancelUrl?.trim() || returnUrl

  const cartId = await payments.createCart({ userId })
  await payments.addCartLine(cartId, {
    ...payments.PAYMENT_SOURCE_TYPES.subscriptionsPlan,
    sourceId: plan.id,
    title: plan.title,
    unitAmountMinor,
    billingPeriod: plan.billingPeriod,
    metadata: {
      userId,
      subject: plan.subject,
      audience: plan.audience,
      billingPeriod: plan.billingPeriod,
      entitlementKeys: plan.entitlementKeys,
      groupIds: plan.groupIds,
      sourceModule: plan.sourceModule,
      sourceType: plan.sourceType,
      sourceId: plan.sourceId,
    },
  })

  const idempotencyKey = `sub_${plan.id}_${userId}_${Date.now()}`
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
    metadata: { userId, planId: plan.id, subject: plan.subject },
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
