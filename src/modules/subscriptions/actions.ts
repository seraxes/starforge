'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminArea } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  adminCompPeriod,
  createPlan,
  setPlanActive,
  updatePlan,
} from './store'
import { ensureSubscriptionsPaymentHook, startSubscriptionCheckout } from './payment-bridge'
import { ensureSubscriptionsExpiryJob } from './expiry'

export type SubscriptionsActionState = { error?: string; ok?: boolean; redirectTo?: string }

async function requireSubscriptionsAdmin(): Promise<SubscriptionsActionState | null> {
  const session = await requireAdminArea('admin.subscriptions')
  if (!session) {
    return {
      error:
        'Sign in with Subscriptions admin access (app admin or ACL → Subscriptions) to manage plans.',
    }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
    return { error: 'Subscriptions is disabled. Enable it under Settings → Modules.' }
  }
  ensureSubscriptionsPaymentHook()
  ensureSubscriptionsExpiryJob()
  return null
}

export async function createPlanAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const denied = await requireSubscriptionsAdmin()
  if (denied) return denied

  const result = await createPlan({
    subject: String(formData.get('subject') ?? 'membership'),
    audience: String(formData.get('audience') ?? ''),
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    price: formData.get('price'),
    billingPeriod: formData.get('billingPeriod'),
    entitlementKeys: formData.get('entitlementKeys'),
    groupIds: formData.get('groupIds'),
    sourceModule: String(formData.get('sourceModule') ?? ''),
    sourceType: String(formData.get('sourceType') ?? ''),
    sourceId: String(formData.get('sourceId') ?? ''),
    active: formData.get('active') === '1',
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/subscriptions')
  return { ok: true }
}

export async function updatePlanAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const denied = await requireSubscriptionsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing plan id.' }

  const result = await updatePlan({
    id,
    subject: String(formData.get('subject') ?? 'membership'),
    audience: String(formData.get('audience') ?? ''),
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    price: formData.get('price'),
    billingPeriod: formData.get('billingPeriod'),
    entitlementKeys: formData.get('entitlementKeys'),
    groupIds: formData.get('groupIds'),
    sourceModule: String(formData.get('sourceModule') ?? ''),
    sourceType: String(formData.get('sourceType') ?? ''),
    sourceId: String(formData.get('sourceId') ?? ''),
    active: formData.get('active') === '1',
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/subscriptions')
  return { ok: true }
}

export async function setPlanActiveAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const denied = await requireSubscriptionsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const active = formData.get('active') !== '0'
  const result = await setPlanActive(id, active)
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/subscriptions')
  return { ok: true }
}

export async function adminCompPeriodAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const denied = await requireSubscriptionsAdmin()
  if (denied) return denied

  const planId = String(formData.get('planId') ?? '').trim()
  const userId = String(formData.get('userId') ?? '').trim()
  if (!planId || !userId) return { error: 'Plan and user id required.' }

  const result = await adminCompPeriod({ planId, userId })
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/subscriptions/subscribers')
  return { ok: true }
}

/** Signed-in member starts checkout for a plan. */
export async function startSubscribeAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const session = await getAppSession()
  if (!session?.user?.id) return { error: 'Sign in to subscribe.' }

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)) {
    return { error: 'Subscriptions is disabled.' }
  }

  const planId = String(formData.get('planId') ?? '').trim()
  const method = String(formData.get('method') ?? 'bank_transfer').trim() || 'bank_transfer'
  const couponCode = String(formData.get('couponCode') ?? '').trim() || null

  const result = await startSubscriptionCheckout({
    planId,
    userId: session.user.id,
    buyerEmail: session.user.email || '',
    buyerName: session.user.name || undefined,
    method,
    couponCode,
  })
  if (!result.ok) return { error: result.error }
  return { ok: true, redirectTo: result.redirectUrl || result.redirectPath }
}
