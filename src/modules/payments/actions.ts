'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import type { PaymentMethodKind } from '@/core/payments'

import { parseCouponDiscountInput } from './coupon-rules'
import {
  createCoupon,
  deleteCoupon,
  setCouponActive,
  updateCoupon,
} from './coupons'
import {
  ensureMerchantForUser,
  updateMerchantProfile,
  upsertMerchantCredential,
} from './merchant-store'
import { getOrderWithLines, markOrderPaid, savePaymentsSettings } from './store'
import type { PaymentsSettings } from './types'
import type { BillingProviderKind } from '@/core/payments'

export type PaymentsActionState = { error?: string; ok?: boolean }

async function requirePaymentsAdmin(): Promise<PaymentsActionState | null> {
  const session = await requireAdminArea('admin.payments')
  if (!session) {
    return {
      error: 'Sign in with Payments admin access (app admin or ACL → Payments).',
    }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    return { error: 'Payments module is disabled in Site Settings → Modules.' }
  }
  return null
}

export async function savePaymentsSettingsAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const denied = await requirePaymentsAdmin()
  if (denied) return denied

  const methodsRaw = String(formData.get('enabledMethods') ?? '')
  const enabledMethods = methodsRaw
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean) as PaymentMethodKind[]

  const patch: Partial<PaymentsSettings> = {
    currency: String(formData.get('currency') ?? 'HUF').trim().toUpperCase() || 'HUF',
    amountEntryMode: formData.get('amountEntryMode') === 'net' ? 'net' : 'gross',
    defaultVatRateBps: Number(formData.get('defaultVatRateBps') ?? 2700) || 2700,
    taxCountry: String(formData.get('taxCountry') ?? 'HU').trim().toUpperCase() || 'HU',
    enabledMethods:
      enabledMethods.length > 0
        ? enabledMethods
        : ['bank_transfer', 'pay_at_entrance', 'cash'],
    sellerName: String(formData.get('sellerName') ?? '').trim(),
    sellerAddress: String(formData.get('sellerAddress') ?? '').trim(),
    sellerVatId: String(formData.get('sellerVatId') ?? '').trim(),
    bankIban: String(formData.get('bankIban') ?? '').trim(),
    bankName: String(formData.get('bankName') ?? '').trim(),
    bankAccountName: String(formData.get('bankAccountName') ?? '').trim(),
    entranceInstructions: String(formData.get('entranceInstructions') ?? '').trim(),
    cashInstructions: String(formData.get('cashInstructions') ?? '').trim(),
    invoiceSeriesPrefix: String(formData.get('invoiceSeriesPrefix') ?? 'SF').trim() || 'SF',
    checkoutTtlMinutes: Math.max(5, Number(formData.get('checkoutTtlMinutes') ?? 60) || 60),
  }

  await savePaymentsSettings(patch)
  revalidatePath('/admin/payments')
  revalidatePath('/admin/payments/settings')
  return { ok: true }
}

export async function markOrderPaidAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const denied = await requirePaymentsAdmin()
  if (denied) return denied

  const session = await requireAdminArea('admin.payments')
  if (!session?.user?.id) return { error: 'Not signed in' }

  const orderId = String(formData.get('orderId') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  if (!orderId) return { error: 'Missing order id' }
  if (!reason) return { error: 'Audit reason required' }

  const order = await getOrderWithLines(orderId)
  if (!order) return { error: 'Order not found' }

  const result = await markOrderPaid({
    orderId,
    staffUserId: session.user.id,
    reason,
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/admin/payments/orders')
  revalidatePath(`/admin/payments/orders/${orderId}`)
  revalidatePath('/admin/payments/invoices')
  return { ok: true }
}

export async function saveMerchantProfileAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.payments)) {
    return { error: 'Payments module is disabled.' }
  }

  const session = await requireAdminArea('admin.payments-merchant')
  if (!session?.user?.id) {
    return { error: 'Sign in with Merchant payments access.' }
  }

  const userId = session.user.id
  const billingRaw = String(formData.get('billingProvider') ?? 'noop').trim()
  const billingProvider: BillingProviderKind =
    billingRaw === 'billingo' || billingRaw === 'szamlazz' ? billingRaw : 'noop'
  const statusRaw = String(formData.get('status') ?? 'draft').trim()
  const status =
    statusRaw === 'active' || statusRaw === 'suspended' ? statusRaw : 'draft'

  const ensured = await ensureMerchantForUser(userId)
  if (!ensured.ok) return { error: ensured.error }

  const result = await updateMerchantProfile(userId, {
    displayName: String(formData.get('displayName') ?? ''),
    status,
    sellerName: String(formData.get('sellerName') ?? ''),
    sellerAddress: String(formData.get('sellerAddress') ?? ''),
    sellerVatId: String(formData.get('sellerVatId') ?? ''),
    bankAccountName: String(formData.get('bankAccountName') ?? ''),
    bankName: String(formData.get('bankName') ?? ''),
    bankIban: String(formData.get('bankIban') ?? ''),
    entranceInstructions: String(formData.get('entranceInstructions') ?? ''),
    cashInstructions: String(formData.get('cashInstructions') ?? ''),
    billingProvider,
  })
  if (!result.ok) return { error: result.error }

  // Optional credential fields — empty keeps existing.
  const barionKey = String(formData.get('barionPosKey') ?? '').trim()
  const barionPayee = String(formData.get('barionPayeeEmail') ?? '').trim()
  if (barionKey || barionPayee) {
    const cred = await upsertMerchantCredential({
      userId,
      kind: 'barion',
      secretPlain: barionKey || undefined,
      meta: barionPayee ? { payeeEmail: barionPayee } : undefined,
    })
    if (!cred.ok) return { error: cred.error }
  }

  const billingKey = String(formData.get('billingApiKey') ?? '').trim()
  const billingBlockId = String(formData.get('billingBlockId') ?? '').trim()
  if (billingKey && billingProvider !== 'noop') {
    const cred = await upsertMerchantCredential({
      userId,
      kind: billingProvider,
      secretPlain: billingKey,
      meta: billingBlockId ? { blockId: billingBlockId } : {},
    })
    if (!cred.ok) return { error: cred.error }
  }

  revalidatePath('/admin/payments/merchant')
  return { ok: true }
}

function couponFieldsFromForm(formData: FormData) {
  const usageRaw = String(formData.get('usageLimit') ?? '').trim()
  const usageLimit =
    usageRaw === '' ? null : Math.max(1, Math.floor(Number(usageRaw)) || 0) || null
  const sourceModule = String(formData.get('sourceModule') ?? '').trim() || null
  const sourceId = String(formData.get('sourceId') ?? '').trim() || null
  return {
    code: String(formData.get('code') ?? ''),
    discount: parseCouponDiscountInput(formData.get('discount')),
    usageLimit,
    sourceModule,
    sourceId,
    currency: String(formData.get('currency') ?? 'HUF').trim().toUpperCase() || 'HUF',
    active: formData.get('active') === '1' || formData.get('active') === 'true',
  }
}

export async function createCouponAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const denied = await requirePaymentsAdmin()
  if (denied) return denied

  const result = await createCoupon(couponFieldsFromForm(formData))
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/payments/coupons')
  return { ok: true }
}

export async function updateCouponAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const denied = await requirePaymentsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing coupon id' }

  const result = await updateCoupon(id, couponFieldsFromForm(formData))
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/payments/coupons')
  return { ok: true }
}

export async function setCouponActiveAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const denied = await requirePaymentsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing coupon id' }
  const raw = formData.get('setActive')
  const active = raw === '1' || raw === 'true'
  const result = await setCouponActive(id, active)
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/payments/coupons')
  return { ok: true }
}

export async function deleteCouponAction(
  _prev: PaymentsActionState,
  formData: FormData,
): Promise<PaymentsActionState> {
  const denied = await requirePaymentsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing coupon id' }
  const result = await deleteCoupon(id)
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/payments/coupons')
  return { ok: true }
}
