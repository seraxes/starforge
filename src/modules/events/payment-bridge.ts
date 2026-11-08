/**
 * Events ↔ product:payments bridge.
 * Payments owns checkout; Events owns capacity / registration rows.
 */

import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/core/db'
import { majorToMinor } from '@/core/payments'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { effectiveTierPrice } from './price-display'
import { sfEventRegistrations } from './schema'
import { findTicketTierById } from './tiers'

export const EVENTS_PAYMENT_HOOK = 'events.confirmRegistration' as const

let hookRegistered = false

/** Register fulfillment hook once (safe to call repeatedly). */
export function ensureEventsPaymentHook(): void {
  if (hookRegistered) return
  hookRegistered = true

  void import('@/modules/payments/api')
    .then(({ registerPaymentConsumerHook }) => {
      registerPaymentConsumerHook(EVENTS_PAYMENT_HOOK, async (ctx) => {
        const registrationId = String(ctx.metadata.registrationId || '').trim()
        if (!registrationId) return

        if (ctx.status === 'paid') {
          await db
            .update(sfEventRegistrations)
            .set({ status: 'registered', updatedAt: new Date() })
            .where(eq(sfEventRegistrations.id, registrationId))
          return
        }

        if (ctx.status === 'expired' || ctx.status === 'failed') {
          await db
            .update(sfEventRegistrations)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(sfEventRegistrations.id, registrationId))
        }
      })
    })
    .catch(() => {
      /* payments pack may be off */
    })
}

export async function isPaymentsModuleOn(): Promise<boolean> {
  try {
    const settings = await getSiteSettings()
    return isCatalogModuleEnabled(settings, MODULE_IDS.payments)
  } catch {
    return false
  }
}

/** Effective major-unit price for a tier, or null / 0 = free. */
export async function tierRequiresPayment(ticketTierId: string | null | undefined): Promise<{
  requires: boolean
  majorPrice: number | null
  title: string
}> {
  const id = (ticketTierId || '').trim()
  if (!id) return { requires: false, majorPrice: null, title: '' }
  const tier = await findTicketTierById(id)
  if (!tier) return { requires: false, majorPrice: null, title: '' }
  const major = effectiveTierPrice({
    price: tier.price,
    priceModifier: tier.priceModifier,
    priceLabel: tier.priceLabel,
  })
  if (major == null || major <= 0) {
    return { requires: false, majorPrice: major, title: tier.title }
  }
  return { requires: true, majorPrice: major, title: tier.title }
}

export type StartEventTicketCheckoutInput = {
  registrationId: string
  eventId: string
  eventTitle: string
  ticketTierId: string
  buyerEmail: string
  buyerName: string
  userId?: string | null
  guests: number
  /** Premium organizer user id — resolves to payments merchantId when active. */
  merchantUserId?: string | null
  method?: 'bank_transfer' | 'pay_at_entrance' | 'cash' | 'barion' | 'stripe' | 'paypal'
  returnUrl: string
  cancelUrl: string
}

/**
 * Create cart + checkout for a paid ticket. Links order to registration.
 * Call after inserting registration with status `pending_payment`.
 */
export async function startEventTicketCheckout(
  input: StartEventTicketCheckoutInput,
): Promise<{ ok: true; orderId: string; redirectUrl?: string; paymentReference?: string } | { ok: false; error: string }> {
  ensureEventsPaymentHook()

  if (!(await isPaymentsModuleOn())) {
    return { ok: false, error: 'Payments module is disabled' }
  }

  const priced = await tierRequiresPayment(input.ticketTierId)
  if (!priced.requires || priced.majorPrice == null) {
    return { ok: false, error: 'Tier does not require payment' }
  }

  const {
    createCart,
    addCartLine,
    startCheckout,
    getPaymentsSettings,
    getMerchantByUserId,
    PAYMENT_SOURCE_TYPES,
  } = await import('@/modules/payments/api')

  const paySettings = await getPaymentsSettings()
  const unitAmountMinor = majorToMinor(priced.majorPrice, paySettings.currency)
  if (unitAmountMinor == null) {
    return { ok: false, error: 'Invalid price' }
  }

  let merchantId: string | null = null
  const merchantUserId = (input.merchantUserId || '').trim()
  if (merchantUserId) {
    const merchant = await getMerchantByUserId(merchantUserId)
    if (merchant && merchant.status === 'active') {
      merchantId = merchant.id
    }
  }

  const method =
    merchantId
      ? input.method || 'barion'
      : input.method && paySettings.enabledMethods.includes(input.method)
        ? input.method
        : paySettings.enabledMethods[0] || 'bank_transfer'

  const cartId = await createCart({ userId: input.userId })
  const line = await addCartLine(cartId, {
    sourceModule: PAYMENT_SOURCE_TYPES.eventsTicketTier.sourceModule,
    sourceType: PAYMENT_SOURCE_TYPES.eventsTicketTier.sourceType,
    sourceId: input.ticketTierId,
    title: `${input.eventTitle} — ${priced.title}`,
    qty: Math.max(1, input.guests),
    unitAmountMinor,
    metadata: {
      eventId: input.eventId,
      registrationId: input.registrationId,
      merchantUserId: merchantUserId || undefined,
    },
  })
  if (!line.ok) return { ok: false, error: line.error }

  const checkout = await startCheckout({
    cartId,
    method,
    merchantId,
    buyer: {
      email: input.buyerEmail,
      name: input.buyerName,
      userId: input.userId,
    },
    idempotencyKey: `events_reg_${input.registrationId}`,
    returnUrl: input.returnUrl,
    cancelUrl: input.cancelUrl,
    consumerHook: EVENTS_PAYMENT_HOOK,
    metadata: {
      registrationId: input.registrationId,
      eventId: input.eventId,
    },
  })

  if (!checkout.ok) return { ok: false, error: checkout.error }

  await db
    .update(sfEventRegistrations)
    .set({ paymentOrderId: checkout.orderId, updatedAt: new Date() })
    .where(eq(sfEventRegistrations.id, input.registrationId))

  return {
    ok: true,
    orderId: checkout.orderId,
    redirectUrl: checkout.redirectUrl,
    paymentReference: checkout.paymentReference,
  }
}
