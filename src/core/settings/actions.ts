'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { invalidateSiteSettings } from '@/core/content/revalidate'
import {
  DEFAULT_SITE_NAME,
  type FeatureFlags,
  type NavItem,
  updateSiteSettings,
} from '@/core/settings'

export type SettingsActionState = {
  error?: string
  ok?: boolean
}

/** Checkbox fields: missing key means unchecked → false. */
function parseCheckbox(formData: FormData, key: string): boolean {
  const raw = formData.get(key)
  if (raw == null) return false
  return String(raw) === 'true' || String(raw) === 'on' || String(raw) === '1'
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

  const features: FeatureFlags = {
    registration: parseCheckbox(formData, 'featureRegistration'),
    richEditor: parseCheckbox(formData, 'featureRichEditor'),
    posts: parseCheckbox(formData, 'featurePosts'),
    modules: parseCheckbox(formData, 'featureModules'),
    draftPreview: parseCheckbox(formData, 'featureDraftPreview'),
  }

  try {
    // Core admin form edits resolved paths as custom URLs.
    // Prefer Payload Globals → Site settings for Page relationships.
    await updateSiteSettings({ siteName, primaryNav, features })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save site settings.'
    return { error: message }
  }

  // Tag invalidation covers cached site settings + pages that embed chrome.
  // Payload global afterChange also calls this; safe to run twice.
  invalidateSiteSettings()
  revalidatePath('/', 'layout')
  revalidatePath('/register')
  revalidatePath('/login')
  revalidatePath('/app/admin/settings')
  return { ok: true }
}
