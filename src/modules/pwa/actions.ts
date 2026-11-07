'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { savePwaModuleSettings } from './settings'
import type { PwaAdminActionState } from './types'

export type { PwaAdminActionState }

async function requirePwaAdmin(): Promise<PwaAdminActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to manage PWA settings.' }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pwa)) {
    return {
      error: 'PWA is disabled. Enable it under Settings → Modules.',
    }
  }
  return null
}

export async function savePwaSettingsAction(
  _prev: PwaAdminActionState,
  formData: FormData,
): Promise<PwaAdminActionState> {
  const gate = await requirePwaAdmin()
  if (gate) return gate

  try {
    await savePwaModuleSettings({
      shortName: String(formData.get('shortName') ?? ''),
      themeColor: String(formData.get('themeColor') ?? ''),
      backgroundColor: String(formData.get('backgroundColor') ?? ''),
      display: String(formData.get('display') ?? '') as 'standalone',
      startUrl: String(formData.get('startUrl') ?? ''),
      iconMediaId: String(formData.get('iconMediaId') ?? ''),
      iconUrl: String(formData.get('iconUrl') ?? ''),
    })
    revalidatePath('/admin/pwa')
    revalidatePath('/manifest.webmanifest')
    return { ok: true, message: 'PWA settings saved.' }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not save PWA settings.'
    return { error: message }
  }
}
