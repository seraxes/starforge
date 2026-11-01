'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { invalidateSiteSettings } from '@/core/content/revalidate'
import {
  DEFAULT_SITE_NAME,
  featureFlagsFromModuleToggles,
  listInstalledModuleCatalog,
  type ModuleToggleMap,
  type NavItem,
  updateSiteSettings,
} from '@/core/settings'

export type SettingsActionState = {
  error?: string
  ok?: boolean
}

function parseNav(formData: FormData): NavItem[] {
  const labels = formData.getAll('navLabel').map((v) => String(v ?? ''))
  const hrefs = formData.getAll('navHref').map((v) => String(v ?? ''))
  const count = Math.max(labels.length, hrefs.length)
  const items: NavItem[] = []
  for (let i = 0; i < count; i++) {
    const label = (labels[i] ?? '').trim()
    const href = (hrefs[i] ?? '').trim()
    if (!label && !href) continue
    if (!label || !href) continue
    items.push({ label, href })
  }
  return items
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
  const primaryNav = parseNav(formData)
  const catalog = listInstalledModuleCatalog()
  const moduleToggles = parseModuleToggles(formData)
  const features = featureFlagsFromModuleToggles(moduleToggles, catalog)

  try {
    await updateSiteSettings({ siteName, primaryNav, features, moduleToggles })
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
  revalidatePath('/app/admin/layouts')
  revalidatePath('/app/admin/outlines')
  revalidatePath('/app/admin/page-settings')
  revalidatePath('/app/admin')
  return { ok: true }
}
