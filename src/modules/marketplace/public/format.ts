/** Display helpers for marketplace public surfaces. */

import { formatMoneyMinor } from '@/core/payments/money'

export type ListingConditionLabels = {
  new: string
  used: string
  refurbished: string
}

export type ListingStatusLabels = {
  draft: string
  active: string
  pending: string
  sold: string
  hidden: string
  removed: string
  expired: string
}

export function formatListingPrice(
  priceMinor: number | null,
  currency = 'HUF',
  locale = 'hu-HU',
  freeLabel = 'Free',
): string {
  if (priceMinor == null) return freeLabel
  return formatMoneyMinor(priceMinor, currency || 'HUF', locale)
}

export function formatListingDistanceKm(distanceKm: number | null | undefined): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return ''
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`
  return `${Math.round(distanceKm)} km`
}

export function formatListingCondition(
  condition: string,
  labels?: ListingConditionLabels,
): string {
  switch (condition) {
    case 'new':
      return labels?.new ?? 'New'
    case 'refurbished':
      return labels?.refurbished ?? 'Refurbished'
    case 'used':
    default:
      return labels?.used ?? 'Used'
  }
}

/** Member-facing status word (not the raw enum). */
export function formatListingStatus(
  status: string,
  labels?: ListingStatusLabels,
): string {
  switch (status) {
    case 'draft':
      return labels?.draft ?? 'Draft'
    case 'active':
      return labels?.active ?? 'Active'
    case 'pending':
      return labels?.pending ?? 'Pending'
    case 'sold':
      return labels?.sold ?? 'Sold'
    case 'hidden':
      return labels?.hidden ?? 'Hidden'
    case 'removed':
      return labels?.removed ?? 'Removed'
    case 'expired':
      return labels?.expired ?? 'Expired'
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : ''
  }
}

/** Short calendar date for expiry / listing facts. */
export function formatListingDate(
  value: Date | null | undefined,
  locale = 'hu-HU',
): string {
  if (!value || !(value instanceof Date) || Number.isNaN(value.getTime())) return ''
  try {
    return value.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value.toISOString().slice(0, 10)
  }
}
