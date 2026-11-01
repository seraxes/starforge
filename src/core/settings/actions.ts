'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { invalidateSiteSettings } from '@/core/content/revalidate'
import {
  DEFAULT_PRIMARY_NAV_MENU_ID,
  DEFAULT_SITE_NAME,
  featureFlagsFromModuleToggles,
  listInstalledModuleCatalog,
  type ModuleToggleMap,
  updateSiteSettings,
} from '@/core/settings'

export type SettingsActionState = {
  error?: string
  ok?: boolean
}

/** Read Site Settings → Modules toggles; required ids forced on. */
function parseModuleToggles(formData: FormData): ModuleToggleMap {
  const catalog = listInstalledModuleCatalog()
  const ids = formData.getAll('moduleToggleId').map((v) => String(v ?? '').trim()).filter(Boolean)
  const enabledRaw = new Set(
    formData.getAll('moduleToggleEnabled').map((v) => String(v ?? '').trim()).filter(Boolean),
  )

  const map: ModuleToggleMap = {}
  for (const item of catalog) {
    if (item.required) {
      map[item.id] = true
      continue
    }
    const present = ids.length === 0 || ids.includes(item.id)
    if (!present) continue
    map[item.id] = enabledRaw.has(item.id)
  }
  return map
}

export async function updateSiteSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit site settings.' }
  }

  const siteName = String(formData.get('siteName') ?? '').trim() || DEFAULT_SITE_NAME
  const primaryNavMenuId =
    String(formData.get('primaryNavMenuId') ?? '').trim() || DEFAULT_PRIMARY_NAV_MENU_ID
  const catalog = listInstalledModuleCatalog()
  const moduleToggles = parseModuleToggles(formData)
  const features = featureFlagsFromModuleToggles(moduleToggles, catalog)

  try {
    await updateSiteSettings({
      siteName,
      primaryNavMenuId,
      keepLegacyPrimaryNav: true,
      features,
      moduleToggles,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save site settings.'
    return { error: message }
  }

  invalidateSiteSettings()
  revalidatePath('/', 'layout')
  revalidatePath('/register')
  revalidatePath('/login')
  revalidatePath('/app/admin/settings')
  revalidatePath('/app/admin/nav')
  revalidatePath('/app/admin/layouts')
  revalidatePath('/app/admin/outlines')
  revalidatePath('/app/admin/page-settings')
  revalidatePath('/app/admin')
  return { ok: true }
}
