'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminArea } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { normalizeLocaleTextMap, type LocaleTextMap } from '@/core/i18n/locale-text'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { emitSubscriptionsEmail } from './email'
import { ensureSubscriptionsExpiryJob } from './expiry'
import { ensureSubscriptionsPaymentHook, startSubscriptionCheckout } from './payment-bridge'
import { ensureSubscriptionRegistrationFormSeeded } from './registration-form'
import { saveSubscriptionsModuleSettings } from './settings'
import {
  addSeat,
  adminCompPeriod,
  createPlan,
  listPeriods,
  periodsToCsv,
  removeSeat,
  setCancelAtPeriodEnd,
  setPlanActive,
  updatePeriodWindow,
  updatePlan,
} from './store'
import { isCheckoutMode } from './types'
import { loadSubscriberEmail } from './user-email'

export type SubscriptionsActionState = {
  error?: string
  ok?: boolean
  redirectTo?: string
  csv?: string
  periodId?: string
  message?: string
}

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
  void ensureSubscriptionRegistrationFormSeeded()
  return null
}

function parseLocaleMap(formData: FormData, key: string): LocaleTextMap {
  const raw = String(formData.get(key) ?? '').trim()
  if (!raw) return {}
  try {
    return normalizeLocaleTextMap(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

function planFieldsFromForm(formData: FormData) {
  const groupIdsMulti = formData.getAll('groupIds').map((v) => String(v).trim()).filter(Boolean)
  // Hidden marker so an empty multi-select clears groups instead of keeping the prior set.
  const groupIds =
    formData.get('groupIdsField') === '1'
      ? groupIdsMulti
      : groupIdsMulti.length > 0
        ? groupIdsMulti
        : formData.get('groupIds')
  return {
    subject: String(formData.get('subject') ?? 'membership'),
    audience: String(formData.get('audience') ?? ''),
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    price: formData.get('price'),
    billingPeriod: formData.get('billingPeriod'),
    entitlementKeys: formData.get('entitlementKeys'),
    groupIds,
    sourceModule: String(formData.get('sourceModule') ?? ''),
    sourceType: String(formData.get('sourceType') ?? ''),
    sourceId: String(formData.get('sourceId') ?? ''),
    active: formData.get('active') === '1',
    sortOrder: formData.get('sortOrder'),
    trialDurationDays: formData.get('trialDurationDays'),
    trialPrice: formData.get('trialPrice'),
    trialOnce: formData.get('trialOnce') === '1',
    lifetime: formData.get('lifetime') === '1' || formData.get('billingPeriod') === 'lifetime',
    fixedExpiresAt: formData.get('fixedExpiresAt'),
    maxActive: formData.get('maxActive'),
    formDefinitionId: String(formData.get('formDefinitionId') ?? ''),
    earlyRenewDays: formData.get('earlyRenewDays'),
    earlyRenewPrice: formData.get('earlyRenewPrice'),
    upgradeTargetIds: formData.get('upgradeTargetIds'),
    graceHours: formData.get('graceHours'),
    seatLimit: formData.get('seatLimit'),
    recurringSupported: formData.get('recurringSupported') === '1',
    imageMediaId: String(formData.get('imageMediaId') ?? ''),
    titleLocales: parseLocaleMap(formData, 'titleLocales'),
    descriptionLocales: parseLocaleMap(formData, 'descriptionLocales'),
  }
}

export async function saveSubscriptionsSettingsAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const denied = await requireSubscriptionsAdmin()
  if (denied) return denied

  try {
    await saveSubscriptionsModuleSettings({
      reminderDays: Number(formData.get('reminderDays') ?? 7),
      trialReminderDays: Number(formData.get('trialReminderDays') ?? 3),
      defaultGraceHours: Number(formData.get('defaultGraceHours') ?? 0),
      defaultFormDefinitionId: String(formData.get('defaultFormDefinitionId') ?? '').trim(),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { error: msg }
  }
  revalidatePath('/admin/subscriptions/settings')
  return { ok: true }
}

export async function seedSubscriptionsEmailStartersAction(
  _prev: SubscriptionsActionState,
  _formData: FormData,
): Promise<SubscriptionsActionState> {
  const denied = await requireSubscriptionsAdmin()
  if (denied) return denied

  const { seedSubscriptionsEmailStarters } = await import('./email-starters')
  const result = await seedSubscriptionsEmailStarters()
  if (!result.ok) return { error: result.error || 'Seed failed.' }
  revalidatePath('/admin/subscriptions/settings')
  revalidatePath('/admin/email')
  return { ok: true, message: result.message }
}

export async function createPlanAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const denied = await requireSubscriptionsAdmin()
  if (denied) return denied

  const result = await createPlan(planFieldsFromForm(formData))
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

  const result = await updatePlan({ id, ...planFieldsFromForm(formData) })
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
  const flagged = formData.get('setActive')
  const active = flagged != null ? String(flagged) !== '0' : formData.get('active') !== '0'
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

  const buyerEmail = await loadSubscriberEmail(userId)
  if (buyerEmail) {
    await emitSubscriptionsEmail('product:subscriptions/activated', {
      periodId: result.period.id,
      planId,
      userId,
      buyerEmail,
      subject: result.period.subject,
      endsAt: result.period.endsAt.toISOString(),
      entitlementKeys: result.period.entitlementKeys,
      source: 'admin_comp',
    })
  }

  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/subscriptions/subscribers')
  return { ok: true }
}

export async function updatePeriodAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const denied = await requireSubscriptionsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  const statusRaw = String(formData.get('status') ?? '').trim()
  const endsRaw = String(formData.get('endsAt') ?? '').trim()
  if (!id) return { error: 'Missing subscription id.' }
  if (statusRaw !== 'active' && statusRaw !== 'expired') {
    return { error: 'Status must be active or expired.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endsRaw)) return { error: 'End date is required.' }
  const endsAt = new Date(`${endsRaw}T23:59:59.999Z`)
  if (!Number.isFinite(endsAt.getTime())) return { error: 'End date is invalid.' }

  const result = await updatePeriodWindow({ id, status: statusRaw, endsAt })
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/subscriptions/subscribers')
  return { ok: true }
}

export async function exportPeriodsCsvAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const denied = await requireSubscriptionsAdmin()
  if (denied) return denied
  const statusRaw = String(formData.get('status') ?? '').trim()
  const status =
    statusRaw === 'active' || statusRaw === 'expired' || statusRaw === 'refunded'
      ? statusRaw
      : undefined
  const periods = await listPeriods({ status, limit: 500 })
  const csv = await periodsToCsv(periods)
  return { ok: true, csv }
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
  const modeRaw = String(formData.get('mode') ?? 'subscribe').trim()
  const mode = isCheckoutMode(modeRaw) ? modeRaw : 'subscribe'
  const fromPeriodId = String(formData.get('fromPeriodId') ?? '').trim() || null
  const autoRenew = formData.get('autoRenew') === '1'

  const result = await startSubscriptionCheckout({
    planId,
    userId: session.user.id,
    buyerEmail: session.user.email || '',
    buyerName: session.user.name || undefined,
    method,
    couponCode,
    mode,
    fromPeriodId,
    autoRenew,
  })
  if (!result.ok) return { error: result.error }
  if ('free' in result && result.free) {
    revalidatePath('/account/subscriptions')
    return { ok: true, periodId: result.periodId }
  }
  if ('orderId' in result) {
    return { ok: true, redirectTo: result.redirectUrl || result.redirectPath }
  }
  return { error: 'Checkout failed.' }
}

export async function cancelSubscriptionAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const session = await getAppSession()
  if (!session?.user?.id) return { error: 'Sign in required.' }
  const periodId = String(formData.get('periodId') ?? '').trim()
  const cancel = formData.get('cancel') !== '0'
  const result = await setCancelAtPeriodEnd(periodId, session.user.id, cancel)
  if (!result.ok) return { error: result.error }
  revalidatePath('/account/subscriptions')
  return { ok: true }
}

export async function addSeatAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const session = await getAppSession()
  if (!session?.user?.id) return { error: 'Sign in required.' }
  const periodId = String(formData.get('periodId') ?? '').trim()
  const memberUserId = String(formData.get('memberUserId') ?? '').trim()
  const result = await addSeat({
    periodId,
    adminUserId: session.user.id,
    memberUserId,
  })
  if (!result.ok) return { error: result.error }
  revalidatePath('/account/subscriptions')
  return { ok: true }
}

export async function removeSeatAction(
  _prev: SubscriptionsActionState,
  formData: FormData,
): Promise<SubscriptionsActionState> {
  const session = await getAppSession()
  if (!session?.user?.id) return { error: 'Sign in required.' }
  const periodId = String(formData.get('periodId') ?? '').trim()
  const memberUserId = String(formData.get('memberUserId') ?? '').trim()
  const result = await removeSeat({
    periodId,
    adminUserId: session.user.id,
    memberUserId,
  })
  if (!result.ok) return { error: result.error }
  revalidatePath('/account/subscriptions')
  return { ok: true }
}
