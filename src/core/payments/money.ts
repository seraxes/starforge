/**
 * VAT-safe money math — integer minor units only.
 * Minor = ISO 4217 fraction (HUF exponent 0 → forints; EUR/USD → cents).
 * Rounding: unit net/gross first, then × qty (per-line).
 */

import type { MoneyLineComputed, MoneyLineInput, VatCategory } from './types'

/** ISO 4217 fraction digits for currencies we support first. Default 2. */
export function currencyExponent(currency: string): number {
  const c = currency.trim().toUpperCase()
  if (c === 'HUF' || c === 'JPY' || c === 'KRW') return 0
  return 2
}

function roundMinor(n: number): number {
  return Math.round(n)
}

export function computeMoneyLine(input: MoneyLineInput): MoneyLineComputed {
  const qty = Math.max(0, Math.floor(input.qty))
  const vatRateBps = Math.max(0, Math.floor(input.vatRateBps))
  const vatCategory: VatCategory = input.vatCategory ?? 'standard'
  const currency = input.currency.trim().toUpperCase() || 'HUF'
  const rate = vatRateBps / 10_000

  let unitNetMinor: number
  let unitGrossMinor: number

  if (input.amountIsGross) {
    unitGrossMinor = Math.max(0, Math.floor(input.unitAmountMinor))
    unitNetMinor = rate > 0 ? roundMinor(unitGrossMinor / (1 + rate)) : unitGrossMinor
  } else {
    unitNetMinor = Math.max(0, Math.floor(input.unitAmountMinor))
    unitGrossMinor = rate > 0 ? roundMinor(unitNetMinor * (1 + rate)) : unitNetMinor
  }

  const lineNetMinor = unitNetMinor * qty
  const lineGrossMinor = unitGrossMinor * qty
  const vatAmountMinor = lineGrossMinor - lineNetMinor

  return {
    currency,
    qty,
    vatRateBps,
    vatCategory,
    unitNetMinor,
    unitGrossMinor,
    vatAmountMinor,
    lineNetMinor,
    lineGrossMinor,
  }
}

export function sumMoneyLines(lines: MoneyLineComputed[]): {
  currency: string
  totalNetMinor: number
  totalVatMinor: number
  totalGrossMinor: number
} {
  const currency = lines[0]?.currency ?? 'HUF'
  let totalNetMinor = 0
  let totalGrossMinor = 0
  for (const line of lines) {
    totalNetMinor += line.lineNetMinor
    totalGrossMinor += line.lineGrossMinor
  }
  return {
    currency,
    totalNetMinor,
    totalVatMinor: totalGrossMinor - totalNetMinor,
    totalGrossMinor,
  }
}

/** Format minor units for display (not for storage). */
export function formatMoneyMinor(
  amountMinor: number,
  currency: string,
  locale = 'hu-HU',
): string {
  const exp = currencyExponent(currency)
  const major = amountMinor / 10 ** exp
  const c = currency.toUpperCase()
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: c,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(major)
  } catch {
    return `${major.toFixed(exp)} ${c}`
  }
}

/**
 * Convert legacy Events major-unit integers to minor units.
 * Events stored whole currency units (HUF forints / EUR euros) — map by exponent.
 */
export function majorToMinor(
  major: number | null | undefined,
  currency = 'HUF',
): number | null {
  if (major == null || !Number.isFinite(major)) return null
  const exp = currencyExponent(currency)
  return Math.round(major * 10 ** exp)
}

export function minorToMajor(minor: number, currency = 'HUF'): number {
  return minor / 10 ** currencyExponent(currency)
}
