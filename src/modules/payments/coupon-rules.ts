/**
 * Pure coupon discount helpers (safe for client + server).
 * DB resolve/apply lives in coupons.ts.
 */

import { computeMoneyLine, majorToMinor } from '@/core/payments/money'
import type { VatCategory } from '@/core/payments/types'

export type CouponDiscountMode = 'amount' | 'percent'

export type CouponDiscount = {
  mode: CouponDiscountMode
  /** Positive major units or percent points. */
  value: number
}

export type CouponScope = {
  sourceModule: string | null
  sourceId: string | null
}

export type CouponLineInput = {
  id: string
  sourceModule: string
  sourceType: string
  sourceId: string
  title: string
  qty: number
  currency: string
  unitNetMinor: number
  unitGrossMinor: number
  vatRateBps: number
  vatCategory: string
  vatAmountMinor: number
  lineNetMinor: number
  lineGrossMinor: number
  billingPeriod?: string | null
  metadata?: Record<string, unknown> | null
}

export type AppliedCoupon = {
  couponId: string
  code: string
  discountMinor: number
  lines: CouponLineInput[]
}

export type CouponRecord = {
  id: string
  code: string
  discountValue: number
  discountMode: CouponDiscountMode
  usageLimit: number | null
  usedCount: number
  sourceModule: string | null
  sourceId: string | null
  currency: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const ZERO: CouponDiscount = { mode: 'amount', value: 0 }

/** Normalize code for storage / lookup. */
export function normalizeCouponCode(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/**
 * One field: `500` = amount off; `10%` = percent off.
 * Coupons are discounts only — non-positive values are rejected as empty.
 */
export function parseCouponDiscountInput(raw: unknown): CouponDiscount {
  if (raw == null) return ZERO
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const value = Math.trunc(raw)
    return value > 0 ? { mode: 'amount', value } : ZERO
  }
  const s = String(raw).trim().replace(/\s+/g, '')
  if (!s) return ZERO
  const percent = s.endsWith('%')
  const numPart = percent ? s.slice(0, -1) : s
  const n = Number(numPart)
  if (!Number.isFinite(n)) return ZERO
  const value = Math.trunc(n)
  if (value <= 0) return ZERO
  return { mode: percent ? 'percent' : 'amount', value }
}

export function formatCouponDiscountInput(mod: CouponDiscount | null | undefined): string {
  if (!mod || !Number.isFinite(mod.value) || mod.value <= 0) return ''
  return mod.mode === 'percent' ? `${mod.value}%` : String(mod.value)
}

export function lineMatchesCouponScope(
  line: Pick<CouponLineInput, 'sourceModule' | 'sourceId' | 'metadata'>,
  coupon: CouponScope,
): boolean {
  const mod = (coupon.sourceModule || '').trim()
  const sid = (coupon.sourceId || '').trim()
  if (!mod && !sid) return true

  if (mod && line.sourceModule !== mod) return false
  if (!sid) return true

  // Events scopes by event id (cart line sourceId is the tier).
  if (mod === 'product:events') {
    const eventId = String(line.metadata?.eventId ?? '').trim()
    return eventId === sid
  }
  return line.sourceId === sid
}

export function computeCouponDiscountMinor(
  coupon: {
    discountMode: CouponDiscountMode
    discountValue: number
    currency: string
  },
  eligibleGrossMinor: number,
  cartCurrency: string,
): number {
  const base = Math.max(0, Math.floor(eligibleGrossMinor))
  if (base <= 0) return 0
  const mode = coupon.discountMode === 'percent' ? 'percent' : 'amount'
  let discount = 0
  if (mode === 'percent') {
    discount = Math.floor((base * Math.max(0, coupon.discountValue)) / 100)
  } else {
    const currency = (coupon.currency || cartCurrency || 'HUF').trim().toUpperCase()
    const minor = majorToMinor(coupon.discountValue, currency)
    discount = minor == null ? 0 : Math.max(0, minor)
  }
  return Math.min(discount, base)
}

/**
 * Distribute a gross discount across eligible lines; recompute VAT via computeMoneyLine.
 * Ineligible lines are returned unchanged.
 */
export function applyCouponToLines(input: {
  lines: CouponLineInput[]
  coupon: CouponScope & {
    id: string
    code: string
    discountMode: CouponDiscountMode
    discountValue: number
    currency: string
  }
  amountIsGross: boolean
}): AppliedCoupon | { error: string } {
  const currency = (input.lines[0]?.currency || input.coupon.currency || 'HUF')
    .trim()
    .toUpperCase()
  const eligibleIdx: number[] = []
  let eligibleGross = 0
  input.lines.forEach((line, i) => {
    if (!lineMatchesCouponScope(line, input.coupon)) return
    eligibleIdx.push(i)
    eligibleGross += Math.max(0, line.lineGrossMinor)
  })
  if (eligibleIdx.length === 0) {
    return { error: 'Coupon does not apply to items in this cart' }
  }

  const discountMinor = computeCouponDiscountMinor(input.coupon, eligibleGross, currency)
  if (discountMinor <= 0) {
    return { error: 'Coupon discount is zero for this cart' }
  }

  const discounts = new Array(input.lines.length).fill(0) as number[]
  let allocated = 0
  eligibleIdx.forEach((idx, pos) => {
    const line = input.lines[idx]!
    if (pos === eligibleIdx.length - 1) {
      discounts[idx] = discountMinor - allocated
      return
    }
    const share =
      eligibleGross > 0
        ? Math.floor((discountMinor * Math.max(0, line.lineGrossMinor)) / eligibleGross)
        : 0
    discounts[idx] = share
    allocated += share
  })

  const nextLines = input.lines.map((line, i) => {
    const cut = discounts[i] || 0
    if (cut <= 0) return line
    const qty = Math.max(1, line.qty)
    const newLineGross = Math.max(0, line.lineGrossMinor - cut)
    const unitAmountMinor = Math.floor(newLineGross / qty)
    // Discount is taken from gross; always rebuild from the new unit gross.
    const computed = computeMoneyLine({
      currency: line.currency,
      qty,
      unitAmountMinor,
      vatRateBps: line.vatRateBps,
      vatCategory: (line.vatCategory as VatCategory) || 'standard',
      amountIsGross: true,
    })
    return {
      ...line,
      unitNetMinor: computed.unitNetMinor,
      unitGrossMinor: computed.unitGrossMinor,
      vatAmountMinor: computed.vatAmountMinor,
      lineNetMinor: computed.lineNetMinor,
      lineGrossMinor: computed.lineGrossMinor,
    }
  })

  return {
    couponId: input.coupon.id,
    code: input.coupon.code,
    discountMinor,
    lines: nextLines,
  }
}
