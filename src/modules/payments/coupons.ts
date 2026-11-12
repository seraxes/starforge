/**
 * product:payments coupons — DB resolve + apply at checkout.
 * Pure math lives in coupon-rules.ts.
 */

import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  applyCouponToLines,
  normalizeCouponCode,
  type AppliedCoupon,
  type CouponDiscount,
  type CouponLineInput,
  type CouponRecord,
} from './coupon-rules'
import { sfPayCouponRedemptions, sfPayCoupons } from './schema'

export type {
  AppliedCoupon,
  CouponDiscount,
  CouponDiscountMode,
  CouponLineInput,
  CouponRecord,
} from './coupon-rules'
export {
  applyCouponToLines,
  computeCouponDiscountMinor,
  formatCouponDiscountInput,
  lineMatchesCouponScope,
  normalizeCouponCode,
  parseCouponDiscountInput,
} from './coupon-rules'

function mapCouponRow(row: typeof sfPayCoupons.$inferSelect): CouponRecord {
  return {
    id: row.id,
    code: row.code,
    discountValue: row.discountValue,
    discountMode: row.discountMode === 'percent' ? 'percent' : 'amount',
    usageLimit: row.usageLimit ?? null,
    usedCount: row.usedCount ?? 0,
    sourceModule: row.sourceModule ?? null,
    sourceId: row.sourceId ?? null,
    currency: (row.currency || 'HUF').toUpperCase(),
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listCoupons(limit = 200): Promise<CouponRecord[]> {
  const rows = await db
    .select()
    .from(sfPayCoupons)
    .orderBy(desc(sfPayCoupons.createdAt))
    .limit(Math.max(1, Math.min(500, limit)))
  return rows.map(mapCouponRow)
}

export async function findCouponById(id: string): Promise<CouponRecord | null> {
  const [row] = await db.select().from(sfPayCoupons).where(eq(sfPayCoupons.id, id)).limit(1)
  return row ? mapCouponRow(row) : null
}

export async function findCouponByCode(code: string): Promise<CouponRecord | null> {
  const normalized = normalizeCouponCode(code)
  if (!normalized) return null
  const [row] = await db
    .select()
    .from(sfPayCoupons)
    .where(eq(sfPayCoupons.code, normalized))
    .limit(1)
  return row ? mapCouponRow(row) : null
}

export type SaveCouponInput = {
  code: string
  discount: CouponDiscount
  usageLimit?: number | null
  sourceModule?: string | null
  sourceId?: string | null
  currency?: string
  active?: boolean
}

export async function createCoupon(
  input: SaveCouponInput,
): Promise<{ ok: true; coupon: CouponRecord } | { ok: false; error: string }> {
  const code = normalizeCouponCode(input.code)
  if (!code) return { ok: false, error: 'Coupon code is required' }
  if (!input.discount.value || input.discount.value <= 0) {
    return { ok: false, error: 'Discount must be a positive amount or percent (e.g. 500 or 10%)' }
  }
  const existing = await findCouponByCode(code)
  if (existing) return { ok: false, error: 'Coupon code already exists' }

  const { randomUUID } = await import('node:crypto')
  const id = `cpn_${randomUUID().replace(/-/g, '')}`
  const sourceModule = (input.sourceModule || '').trim() || null
  const sourceId = (input.sourceId || '').trim() || null
  const usageLimit =
    input.usageLimit == null || !Number.isFinite(input.usageLimit)
      ? null
      : Math.max(1, Math.floor(input.usageLimit))

  await db.insert(sfPayCoupons).values({
    id,
    code,
    discountValue: input.discount.value,
    discountMode: input.discount.mode,
    usageLimit,
    usedCount: 0,
    sourceModule,
    sourceId,
    currency: (input.currency || 'HUF').trim().toUpperCase() || 'HUF',
    active: input.active !== false,
  })
  const coupon = await findCouponById(id)
  if (!coupon) return { ok: false, error: 'Could not create coupon' }
  return { ok: true, coupon }
}

export async function updateCoupon(
  id: string,
  input: SaveCouponInput,
): Promise<{ ok: true; coupon: CouponRecord } | { ok: false; error: string }> {
  const current = await findCouponById(id)
  if (!current) return { ok: false, error: 'Coupon not found' }

  const code = normalizeCouponCode(input.code)
  if (!code) return { ok: false, error: 'Coupon code is required' }
  if (!input.discount.value || input.discount.value <= 0) {
    return { ok: false, error: 'Discount must be a positive amount or percent (e.g. 500 or 10%)' }
  }
  if (code !== current.code) {
    const clash = await findCouponByCode(code)
    if (clash) return { ok: false, error: 'Coupon code already exists' }
  }

  const usageLimit =
    input.usageLimit == null || !Number.isFinite(input.usageLimit)
      ? null
      : Math.max(1, Math.floor(input.usageLimit))

  await db
    .update(sfPayCoupons)
    .set({
      code,
      discountValue: input.discount.value,
      discountMode: input.discount.mode,
      usageLimit,
      sourceModule: (input.sourceModule || '').trim() || null,
      sourceId: (input.sourceId || '').trim() || null,
      currency: (input.currency || current.currency || 'HUF').trim().toUpperCase() || 'HUF',
      active: input.active !== false,
      updatedAt: new Date(),
    })
    .where(eq(sfPayCoupons.id, id))

  const coupon = await findCouponById(id)
  if (!coupon) return { ok: false, error: 'Could not update coupon' }
  return { ok: true, coupon }
}

export async function setCouponActive(
  id: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await findCouponById(id)
  if (!current) return { ok: false, error: 'Coupon not found' }
  await db
    .update(sfPayCoupons)
    .set({ active, updatedAt: new Date() })
    .where(eq(sfPayCoupons.id, id))
  return { ok: true }
}

export async function deleteCoupon(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await findCouponById(id)
  if (!current) return { ok: false, error: 'Coupon not found' }
  await db.delete(sfPayCoupons).where(eq(sfPayCoupons.id, id))
  return { ok: true }
}

/**
 * Resolve a code for checkout. Fails closed on inactive / exhausted / currency mismatch.
 */
export async function resolveCouponForCheckout(input: {
  code: string
  cartCurrency: string
  lines: CouponLineInput[]
  amountIsGross: boolean
}): Promise<AppliedCoupon | { error: string }> {
  const code = normalizeCouponCode(input.code)
  if (!code) return { error: 'Coupon code is required' }

  const coupon = await findCouponByCode(code)
  if (!coupon || !coupon.active) return { error: 'Invalid or inactive coupon' }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { error: 'Coupon usage limit reached' }
  }

  const cartCurrency = (input.cartCurrency || 'HUF').trim().toUpperCase()
  if (
    coupon.discountMode === 'amount' &&
    coupon.currency &&
    coupon.currency !== cartCurrency
  ) {
    return { error: 'Coupon currency does not match cart' }
  }

  return applyCouponToLines({
    lines: input.lines,
    coupon,
    amountIsGross: input.amountIsGross,
  })
}

/** Record redemption + bump usedCount after the order row exists. */
export async function recordCouponRedemption(input: {
  couponId: string
  orderId: string
  discountMinor: number
}): Promise<void> {
  const { randomUUID } = await import('node:crypto')
  await db.insert(sfPayCouponRedemptions).values({
    id: `cred_${randomUUID().replace(/-/g, '')}`,
    couponId: input.couponId,
    orderId: input.orderId,
    discountMinor: Math.max(0, Math.floor(input.discountMinor)),
  })
  await db
    .update(sfPayCoupons)
    .set({
      usedCount: sql`${sfPayCoupons.usedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sfPayCoupons.id, input.couponId),
        sql`(${sfPayCoupons.usageLimit} is null or ${sfPayCoupons.usedCount} < ${sfPayCoupons.usageLimit})`,
      ),
    )
}
