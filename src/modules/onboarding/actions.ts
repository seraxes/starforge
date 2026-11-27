'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  createStatus,
  deleteStatus,
  ensureSeededStatuses,
  updateStatus,
} from './store'

export type OnboardingAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
}

async function requireOnboardingAdmin(): Promise<OnboardingAdminActionState | null> {
  const session = await requireAdminArea('admin.onboarding', 'edit')
  if (!session) {
    return {
      error:
        'Sign in with Onboarding admin access (app admin or ACL → Onboarding) to manage statuses.',
    }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) {
    return { error: 'Onboarding is disabled. Enable it under Settings → Modules.' }
  }
  return null
}

function revalidateOnboardingAdmin() {
  revalidatePath('/admin/onboarding')
}

export async function createOnboardingStatusAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const denied = await requireOnboardingAdmin()
  if (denied) return denied

  await ensureSeededStatuses()
  const result = await createStatus({
    name: formData.get('name'),
    key: formData.get('key'),
    bookable: formData.get('bookable') === '1',
    formDefinitionId: formData.get('formDefinitionId'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Status created.' }
}

export async function updateOnboardingStatusAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const denied = await requireOnboardingAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing status id.' }

  const result = await updateStatus(id, {
    name: formData.get('name'),
    key: formData.get('key'),
    bookable: formData.get('bookable') === '1',
    formDefinitionId: formData.get('formDefinitionId'),
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Status saved.' }
}

export async function deleteOnboardingStatusAction(
  _prev: OnboardingAdminActionState,
  formData: FormData,
): Promise<OnboardingAdminActionState> {
  const denied = await requireOnboardingAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing status id.' }
  const result = await deleteStatus(id)
  if (!result.ok) return { error: result.error }
  revalidateOnboardingAdmin()
  return { ok: true, message: 'Status deleted.' }
}
