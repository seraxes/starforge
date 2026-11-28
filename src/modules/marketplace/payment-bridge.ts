/**
 * Marketplace ↔ product:payments bridge.
 * Payments owns checkout; Marketplace owns listing status after the fee.
 */

import 'server-only'

import { eq } from 'drizzle-orm'
import { getLocale } from 'next-intl/server'

import { db, sfUsers } from '@/core/db'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { applyMarketplaceListingFeeHook, getMarketplaceListing } from './listings'
import { loadMarketplaceModuleSettings } from './settings'

export const MARKETPLACE_LISTING_FEE_HOOK = 'marketplace.listingFeePaid' as const

let hookReady: Promise<void> | null = null

async function loadSellerEmail(userId: string): Promise<string> {
  const id = userId.trim()
  if (!id) return ''
  try {
    const rows = await db
      .select({ email: sfUsers.email })
      .from(sfUsers)
      .where(eq(sfUsers.id, id))
      .limit(1)
    return String(rows[0]?.email ?? '')
      .trim()
      .toLowerCase()
  } catch {
    return ''
  }
}

export async function applyMarketplaceListingFeePaymentResult(
  orderId: string,
  status: 'paid' | 'expired' | 'failed' | 'refunded',
  lines: Array<{
    sourceModule: string
    sourceType: string
    sourceId: string
    qty: number
    metadata: Record<string, unknown>
  }>,
): Promise<void> {
  const id = orderId.trim()
  if (!id) return

  for (const line of lines) {
    if (line.sourceModule !== 'product:marketplace' || line.sourceType !== 'listing') {
      continue
    }
    const listingId = String(line.sourceId ?? '').trim()
    if (!listingId) continue
    await applyMarketplaceListingFeeHook(listingId, status)
  }
}

/** Resolves once the Payments fulfillment hook is registered. */
export function ensureMarketplacePaymentHookReady(): Promise<void> {
  if (!hookReady) {
    hookReady = import('@/modules/payments/api')
      .then(({ registerPaymentConsumerHook }) => {
        registerPaymentConsumerHook(MARKETPLACE_LISTING_FEE_HOOK, async (ctx) => {
          await applyMarketplaceListingFeePaymentResult(ctx.orderId, ctx.status, ctx.lines)
        })
      })
      .catch((error) => {
        console.error('[marketplace] payment hook register failed', error)
        hookReady = null
      })
  }
  return hookReady ?? Promise.resolve()
}

/** Register fulfillment hook once (safe to call repeatedly). */
export function ensureMarketplacePaymentHook(): void {
  void ensureMarketplacePaymentHookReady()
}

export async function isPaymentsModuleOn(): Promise<boolean> {
  try {
    const settings = await getSiteSettings()
    return isCatalogModuleEnabled(settings, MODULE_IDS.payments)
  } catch {
    return false
  }
}

export type StartListingFeeCheckoutInput = {
  listingId: string
  sellerUserId: string
  /** Optional override; otherwise loaded from the user row. */
  buyerEmail?: string | null
  method?: string
  returnUrl?: string
  cancelUrl?: string
  couponCode?: string | null
}

export type StartListingFeeCheckoutResult =
  | { ok: true; orderId: string; redirectPath: string; redirectUrl?: string }
  | { ok: false; error: string }

/**
 * Quote listingFeeMinor server-side and add a Payments cart line.
 * Never trusts a client amount. Item price is not charged.
 */
export async function startListingFeeCheckout(
  input: StartListingFeeCheckoutInput,
): Promise<StartListingFeeCheckoutResult> {
  const listingId = String(input.listingId ?? '').trim()
  const sellerUserId = String(input.sellerUserId ?? '').trim()
  if (!listingId || !sellerUserId) {
    return { ok: false, error: 'Listing and seller are required.' }
  }

  const site = await getSiteSettings()
  if (!isCatalogModuleEnabled(site, MODULE_IDS.marketplace)) {
    return { ok: false, error: 'Marketplace is disabled.' }
  }
  if (!(await isPaymentsModuleOn())) {
    return { ok: false, error: 'Payments is disabled.' }
  }

  const listing = await getMarketplaceListing(listingId)
  if (!listing) return { ok: false, error: 'Listing not found.' }
  if (listing.sellerUserId !== sellerUserId) {
    return { ok: false, error: 'Only the seller may pay the listing fee.' }
  }
  if (listing.status !== 'draft') {
    return { ok: false, error: 'Listing fee applies to draft listings only.' }
  }

  const { settings } = await loadMarketplaceModuleSettings()
  if (!settings.listingFeeEnabled) {
    return { ok: false, error: 'Listing fee is not required.' }
  }
  const feeMinor =
    typeof settings.listingFeeMinor === 'number' &&
    Number.isFinite(settings.listingFeeMinor) &&
    settings.listingFeeMinor > 0
      ? Math.trunc(settings.listingFeeMinor)
      : 0
  if (feeMinor <= 0) {
    return { ok: false, error: 'Listing fee amount is not set.' }
  }

  const email =
    String(input.buyerEmail ?? '').trim().toLowerCase() ||
    (await loadSellerEmail(sellerUserId))
  if (!email) return { ok: false, error: 'Buyer email is required for checkout.' }

  ensureMarketplacePaymentHook()

  const payments = await import('@/modules/payments/api')
  const paySettings = await payments.getPaymentsSettings()
  const method =
    input.method && paySettings.enabledMethods.includes(input.method)
      ? input.method
      : paySettings.enabledMethods[0] || 'bank_transfer'

  let locale: AppLocale = DEFAULT_LOCALE
  try {
    const loc = await getLocale()
    if (isAppLocale(loc)) locale = loc
  } catch {
    /* default */
  }

  const returnUrl =
    input.returnUrl?.trim() ||
    withLocalePrefix(locale, `/marketplace/${listingId}`)
  const cancelUrl =
    input.cancelUrl?.trim() || withLocalePrefix(locale, `/marketplace/you`)

  const cartId = await payments.createCart({ userId: sellerUserId })
  const line = await payments.addCartLine(cartId, {
    ...payments.PAYMENT_SOURCE_TYPES.marketplaceListing,
    sourceId: listingId,
    title: `Listing fee — ${listing.title}`.slice(0, 500),
    qty: 1,
    unitAmountMinor: feeMinor,
    metadata: {
      listingId,
      sellerUserId,
    },
  })
  if (!line.ok) return { ok: false, error: line.error }

  const started = await payments.startCheckout({
    cartId,
    method: method as never,
    buyer: {
      email,
      userId: sellerUserId,
    },
    idempotencyKey: `marketplace_listing_fee_${listingId}`,
    returnUrl,
    cancelUrl,
    consumerHook: MARKETPLACE_LISTING_FEE_HOOK,
    couponCode: input.couponCode || undefined,
    metadata: {
      listingId,
      sellerUserId,
      buyerEmail: email,
    },
  })

  if (!started.ok) return { ok: false, error: started.error }

  const redirectPath = withLocalePrefix(locale, `/checkout/${started.orderId}`)
  return {
    ok: true,
    orderId: started.orderId,
    redirectPath,
    redirectUrl: started.redirectUrl,
  }
}
