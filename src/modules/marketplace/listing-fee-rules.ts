/**
 * Pure listing-fee publish + Payments hook rules.
 * Store / payment-bridge call these; unit tests hit this module without DB or Payments.
 */

import type { ListingStatus } from './listing-rules'

export type ListingFeeSettings = {
  listingFeeEnabled: boolean
  listingFeeMinor: number
}

export type ListingPublishFeeDecision = {
  /** Initial listing status on create when publishing. */
  status: 'draft' | 'active'
  /** True only when Payments must collect listingFeeMinor before activation. */
  needsCart: boolean
  /** Server-quoted fee in minor units (never a client amount). */
  feeMinor: number
}

/**
 * Fee off (default) → publish as active, no cart.
 * Fee on with a positive listingFeeMinor → stay draft until marketplace.listingFeePaid.
 * Fee on with zero minor → treat as free publish (nothing to charge).
 */
export function decideListingPublishWithFee(
  settings: ListingFeeSettings,
  publish: boolean,
): ListingPublishFeeDecision {
  if (!publish) {
    return { status: 'draft', needsCart: false, feeMinor: 0 }
  }
  if (!settings.listingFeeEnabled) {
    return { status: 'active', needsCart: false, feeMinor: 0 }
  }
  const raw = settings.listingFeeMinor
  const feeMinor =
    typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0
  if (feeMinor <= 0) {
    return { status: 'active', needsCart: false, feeMinor: 0 }
  }
  return { status: 'draft', needsCart: true, feeMinor }
}

export type ListingFeeHookAction =
  | { action: 'activate'; nextStatus: 'active' }
  | { action: 'hide'; nextStatus: 'hidden' }
  | { action: 'leave_draft' }
  | { action: 'noop' }

/**
 * Idempotent fulfillment for marketplace.listingFeePaid.
 * paid on draft → activate; paid again on active → noop.
 * expired / failed leave draft; refunded → hidden.
 */
export function decideListingFeeHookAction(
  listingStatus: ListingStatus,
  paymentStatus: 'paid' | 'expired' | 'failed' | 'refunded',
): ListingFeeHookAction {
  if (paymentStatus === 'paid') {
    if (listingStatus === 'draft') {
      return { action: 'activate', nextStatus: 'active' }
    }
    return { action: 'noop' }
  }
  if (paymentStatus === 'expired' || paymentStatus === 'failed') {
    if (listingStatus === 'draft') return { action: 'leave_draft' }
    return { action: 'noop' }
  }
  // refunded
  if (listingStatus === 'removed') return { action: 'noop' }
  if (listingStatus === 'hidden') return { action: 'noop' }
  return { action: 'hide', nextStatus: 'hidden' }
}
