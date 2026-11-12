/**
 * Events ↔ product:payments bridge.
 * Payments owns checkout; Events owns capacity / registration rows.
 */

import 'server-only'

import { eq } from 'drizzle-orm'
import { getLocale } from 'next-intl/server'

import { db } from '@/core/db'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import { majorToMinor } from '@/core/payments'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  emitEventsRegisteredLifecycle,
  emitEventsRegistrantCancelled,
  emitEventsSignupEmails,
  ensureEventsReminderJob,
  mapRegistrationRowForEmail,
} from './email-emit'
import { quoteTierMajor, sumFormPriceAddons } from './price-rules'
import { eventPublicPathKey } from './public/path'
import {
  registrationHoldsSeat,
  resolveStatusAfterPayment,
} from './registration-status'
import { sfEventRegistrations } from './schema'
import { findEventById } from './store'
import { findTicketTierById } from './tiers'

export const EVENTS_PAYMENT_HOOK = 'events.confirmRegistration' as const

let hookReady: Promise<void> | null = null

/**
 * Apply a Payments result to the registration.
 * `paid` confirms the seat, or leaves it `pending` when the event requires
 * approval. `expired` / `failed` / `refunded` cancel it and promote the
 * waitlist when the row held a seat. Already-cancelled rows are left alone.
 */
export async function applyEventsPaymentResult(
  registrationId: string,
  status: 'paid' | 'expired' | 'failed' | 'refunded',
): Promise<void> {
  const id = registrationId.trim()
  if (!id) return

  if (status === 'paid') {
    const [before] = await db
      .select({
        eventId: sfEventRegistrations.eventId,
        status: sfEventRegistrations.status,
      })
      .from(sfEventRegistrations)
      .where(eq(sfEventRegistrations.id, id))
      .limit(1)
    // pending_payment = normal path; cancelled = late webhook after TTL expiry sweep.
    if (
      !before ||
      (before.status !== 'pending_payment' && before.status !== 'cancelled')
    ) {
      return
    }

    const event = await findEventById(before.eventId)
    const next = resolveStatusAfterPayment(event?.requireApproval === true)
    await db
      .update(sfEventRegistrations)
      .set({ status: next, updatedAt: new Date() })
      .where(eq(sfEventRegistrations.id, id))
    if (next === 'registered') {
      await emitRegisteredEmailForRegistration(id)
    } else {
      await emitPendingApprovalEmail(id)
    }
    return
  }

  const [before] = await db
    .select({
      eventId: sfEventRegistrations.eventId,
      status: sfEventRegistrations.status,
    })
    .from(sfEventRegistrations)
    .where(eq(sfEventRegistrations.id, id))
    .limit(1)
  if (!before || before.status === 'cancelled') return

  await db
    .update(sfEventRegistrations)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(sfEventRegistrations.id, id))
  await emitCancelledEmailForRegistration(id)
  if (registrationHoldsSeat(before.status)) {
    const { promoteWaitlistForEvent } = await import('./registrations')
    await promoteWaitlistForEvent(before.eventId)
  }
}

async function emitPendingApprovalEmail(registrationId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(sfEventRegistrations)
    .where(eq(sfEventRegistrations.id, registrationId))
    .limit(1)
  if (!row || row.status !== 'pending') return

  const event = await findEventById(row.eventId)
  if (!event) return

  let tierTitle = ''
  if (row.ticketTierId) {
    const tier = await findTicketTierById(row.ticketTierId)
    tierTitle = tier?.title || ''
  }

  await emitEventsSignupEmails({
    event,
    registration: mapRegistrationRowForEmail(row),
    ticketTierTitle: tierTitle,
  })
}

async function emitRegisteredEmailForRegistration(registrationId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(sfEventRegistrations)
    .where(eq(sfEventRegistrations.id, registrationId))
    .limit(1)
  if (!row || row.status !== 'registered') return

  const event = await findEventById(row.eventId)
  if (!event) return

  let tierTitle = ''
  if (row.ticketTierId) {
    const tier = await findTicketTierById(row.ticketTierId)
    tierTitle = tier?.title || ''
  }

  await emitEventsRegisteredLifecycle({
    event,
    registration: mapRegistrationRowForEmail(row),
    ticketTierTitle: tierTitle,
  })
}

async function emitCancelledEmailForRegistration(registrationId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(sfEventRegistrations)
    .where(eq(sfEventRegistrations.id, registrationId))
    .limit(1)
  if (!row || row.status !== 'cancelled') return

  const event = await findEventById(row.eventId)
  if (!event) return

  let tierTitle = ''
  if (row.ticketTierId) {
    const tier = await findTicketTierById(row.ticketTierId)
    tierTitle = tier?.title || ''
  }

  await emitEventsRegistrantCancelled({
    event,
    registration: mapRegistrationRowForEmail(row),
    ticketTierTitle: tierTitle,
  })
}

/** Resolves once the Payments fulfillment hook is registered. */
export function ensureEventsPaymentHookReady(): Promise<void> {
  if (hookReady) return hookReady
  ensureEventsReminderJob()
  hookReady = import('@/modules/payments/api')
    .then(({ registerPaymentConsumerHook }) => {
      registerPaymentConsumerHook(EVENTS_PAYMENT_HOOK, async (ctx) => {
        const registrationId = String(ctx.metadata.registrationId || '').trim()
        if (!registrationId) return
        await applyEventsPaymentResult(registrationId, ctx.status)
      })
    })
    .catch(() => {
      hookReady = null
    })
  return hookReady
}

/** Register fulfillment hook once (safe to call repeatedly). */
export function ensureEventsPaymentHook(): void {
  void ensureEventsPaymentHookReady()
  void import('./abandoned-checkout')
    .then((mod) => mod.ensureAbandonedCheckoutSweep())
    .catch(() => {
      /* sweep is best-effort when the process is up */
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
export async function tierRequiresPayment(
  ticketTierId: string | null | undefined,
  extras?: { payload?: Record<string, unknown>; userId?: string | null },
): Promise<{
  requires: boolean
  majorPrice: number | null
  title: string
  currency: string
}> {
  const id = (ticketTierId || '').trim()
  if (!id) return { requires: false, majorPrice: null, title: '', currency: '' }
  const tier = await findTicketTierById(id)
  if (!tier) return { requires: false, majorPrice: null, title: '', currency: '' }
  const event = await findEventById(tier.eventId)
  const { countRegisteredGuests } = await import('./registrations')
  const sold = await countRegisteredGuests(tier.eventId)

  let formAddonMajor = 0
  const payload = extras?.payload
  if (payload) {
    try {
      const { resolveRegistrationFormIdForEvent } = await import('./registration-form')
      const { loadFormDefinition, DEFAULT_EVENT_REGISTRATION_FORM_ID } = await import(
        '@/modules/forms/api'
      )
      const preferredId = await resolveRegistrationFormIdForEvent(tier.eventId)
      let loaded = await loadFormDefinition(preferredId)
      if (loaded.source !== 'database') {
        loaded = await loadFormDefinition(DEFAULT_EVENT_REGISTRATION_FORM_ID)
      }
      formAddonMajor = sumFormPriceAddons(loaded.document.fields, payload)
    } catch {
      formAddonMajor = 0
    }
  }

  let hasMemberEntitlement = false
  let audienceGroupIds: string[] = []
  const userId = (extras?.userId || '').trim()
  if (userId) {
    try {
      const { resolveAudience, ENTITLEMENT_KEYS } = await import(
        '@/modules/subscriptions/api'
      )
      const audience = await resolveAudience(userId)
      hasMemberEntitlement = audience.entitlementKeys.includes(
        ENTITLEMENT_KEYS.eventsMember,
      )
      audienceGroupIds = audience.groupIds
    } catch {
      /* subscriptions off / missing */
    }
  }

  const major = quoteTierMajor({
    eventPrice: event?.price ?? null,
    price: tier.price,
    memberPrice: tier.memberPrice,
    groupPrices: tier.groupPrices,
    hasMemberEntitlement,
    audienceGroupIds,
    priceModifier: tier.priceModifier,
    priceModifierMode: tier.priceModifierMode,
    rules: event?.priceRules,
    startsAt: event?.startsAt ?? null,
    sold,
    capacity: event?.capacity ?? null,
    formAddonMajor,
  })
  const { getPaymentsSettings } = await import('@/modules/payments/api')
  const paySettings = await getPaymentsSettings()
  const currency = (event?.currency || '').trim() || paySettings.currency
  if (major <= 0) {
    return { requires: false, majorPrice: major, title: tier.title, currency }
  }
  return { requires: true, majorPrice: major, title: tier.title, currency }
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
  /** Registration form payload — option prices are re-resolved here. */
  payload?: Record<string, unknown>
  /** Payments coupon code — forwarded to startCheckout; not applied in quoteTierMajor. */
  couponCode?: string | null
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

  const priced = await tierRequiresPayment(input.ticketTierId, {
    payload: input.payload,
    userId: input.userId,
  })
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
  const currency = priced.currency || paySettings.currency
  const unitAmountMinor = majorToMinor(priced.majorPrice, currency)
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

  const cartId = await createCart({ userId: input.userId, currency })
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
    couponCode: input.couponCode || undefined,
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

export type BeginPaidTicketCheckoutInput = {
  registrationId: string
  event: {
    id: string
    title: string
    slug?: string | null
    merchantUserId?: string | null
  }
  ticketTierId: string
  buyerEmail: string
  buyerName: string
  userId?: string | null
  guests: number
  method?: StartEventTicketCheckoutInput['method']
  payload?: Record<string, unknown>
  /** Payments coupon — forwarded only; Payments owns resolve/apply. */
  couponCode?: string | null
}

export type BeginPaidTicketCheckoutResult =
  | { ok: true; orderId: string; checkoutPath: string }
  | { ok: false; error: string }

async function resolveRequestLocale(): Promise<AppLocale> {
  try {
    const locale = await getLocale()
    return isAppLocale(locale) ? locale : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

/**
 * Hold the seat as `pending_payment`, start shared checkout, return a same-origin
 * `/[locale]/checkout/[orderId]` path. Cancels the hold if checkout cannot start.
 * When the event requires approval, that gate runs after payment, not here.
 */
export async function beginPaidTicketCheckout(
  input: BeginPaidTicketCheckoutInput,
): Promise<BeginPaidTicketCheckoutResult> {
  ensureEventsPaymentHook()

  if (!(await isPaymentsModuleOn())) {
    return { ok: false, error: 'Payments module is disabled' }
  }

  const priced = await tierRequiresPayment(input.ticketTierId, {
    payload: input.payload,
    userId: input.userId,
  })
  if (!priced.requires) {
    return { ok: false, error: 'Tier does not require payment' }
  }

  const registrationId = input.registrationId.trim()
  if (!registrationId) return { ok: false, error: 'Missing registration id' }

  await db
    .update(sfEventRegistrations)
    .set({ status: 'pending_payment', updatedAt: new Date() })
    .where(eq(sfEventRegistrations.id, registrationId))

  const locale = await resolveRequestLocale()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const eventPath = withLocalePrefix(
    `/events/${eventPublicPathKey({ id: input.event.id, slug: input.event.slug || '' })}`,
    locale,
  )
  const returnUrl = `${appUrl}${eventPath}?paid=1`
  const cancelUrl = `${appUrl}${eventPath}?paid=0`

  const checkout = await startEventTicketCheckout({
    registrationId,
    eventId: input.event.id,
    eventTitle: input.event.title,
    ticketTierId: input.ticketTierId,
    buyerEmail: input.buyerEmail,
    buyerName: input.buyerName,
    userId: input.userId,
    guests: input.guests,
    merchantUserId: input.event.merchantUserId || null,
    method: input.method,
    returnUrl,
    cancelUrl,
    payload: input.payload,
    couponCode: input.couponCode,
  })

  if (!checkout.ok) {
    await db
      .update(sfEventRegistrations)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(sfEventRegistrations.id, registrationId))
    return { ok: false, error: checkout.error }
  }

  return {
    ok: true,
    orderId: checkout.orderId,
    checkoutPath: withLocalePrefix(`/checkout/${checkout.orderId}`, locale),
  }
}
