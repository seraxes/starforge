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
