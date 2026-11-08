/**
 * Ticket / faction price display.
 * Numeric major units on tiers; formatting prefers product:payments helpers when available.
 */

import { formatMoneyMinor, majorToMinor } from '@/core/payments/money'

export type TierPriceFields = {
  price: number | null
  priceModifier: number
  priceLabel: string
}

/** Effective numeric amount (base + modifier), or null when no base price. */
export function effectiveTierPrice(fields: TierPriceFields): number | null {
  if (fields.price == null) return null
  const mod =
    typeof fields.priceModifier === 'number' && Number.isFinite(fields.priceModifier)
      ? Math.floor(fields.priceModifier)
      : 0
  return Math.floor(fields.price) + mod
}

/**
 * Card / select label price text.
 * Optional `priceLabel` always wins; otherwise format via payments money helpers (0 → Free).
 */
export function formatTierPriceDisplay(
  fields: TierPriceFields,
  currency = 'HUF',
  locale = 'hu-HU',
): string {
  const override = (fields.priceLabel || '').trim()
  if (override) return override
  const total = effectiveTierPrice(fields)
  if (total == null) return ''
  if (total === 0) return 'Free'
  const minor = majorToMinor(total, currency)
  if (minor == null) return String(total)
  return formatMoneyMinor(minor, currency, locale)
}
