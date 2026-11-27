/** Display helpers for marketplace public surfaces. */

import { formatMoneyMinor } from '@/core/payments/money'

export function formatListingPrice(
  priceMinor: number | null,
  currency = 'HUF',
  locale = 'hu-HU',
): string {
  if (priceMinor == null) return 'Free'
  return formatMoneyMinor(priceMinor, currency || 'HUF', locale)
}

export function formatListingDistanceKm(distanceKm: number | null | undefined): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return ''
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`
  return `${Math.round(distanceKm)} km`
}

export function formatListingCondition(condition: string): string {
  switch (condition) {
    case 'new':
      return 'New'
    case 'refurbished':
      return 'Refurbished'
    case 'used':
    default:
      return 'Used'
  }
}

/** Member-facing status word (not the raw enum). */
export function formatListingStatus(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'active':
      return 'Active'
    case 'pending':
      return 'Pending'
    case 'sold':
      return 'Sold'
    case 'hidden':
      return 'Hidden'
    case 'removed':
      return 'Removed'
    case 'expired':
      return 'Expired'
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
