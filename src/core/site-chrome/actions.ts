'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { invalidateSiteChrome, invalidateSiteSettings } from '@/core/content/revalidate'

import { CAPTCHA_PROVIDERS, isCaptchaProvider } from './defaults'
import { saveSiteChrome } from './store'
import type { CaptchaProvider } from './types'

export type SiteChromeActionState = {
  error?: string
  ok?: boolean
}

function parseBool(formData: FormData, key: string): boolean {
  const raw = formData.get(key)
  return raw === 'on' || raw === 'true' || raw === '1'
}

export async function updateSiteChromeAction(
  _prev: SiteChromeActionState,
  formData: FormData,
): Promise<SiteChromeActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit Site Chrome.' }
  }

  const captchaRaw = String(formData.get('captchaProvider') ?? 'none').trim()
  const captchaProvider: CaptchaProvider = isCaptchaProvider(captchaRaw)
    ? captchaRaw
    : 'none'

  // Guard against unexpected provider values from a stale form.
  if (!CAPTCHA_PROVIDERS.some((p) => p.value === captchaProvider)) {
    return { error: 'Unknown captcha provider.' }
  }

  try {
    await saveSiteChrome({
      offlineEnabled: parseBool(formData, 'offlineEnabled'),
      offlineMessage: String(formData.get('offlineMessage') ?? ''),
      captchaEnabled: parseBool(formData, 'captchaEnabled'),
      captchaProvider,
      siteName: String(formData.get('siteName') ?? ''),
      defaultDescription: String(formData.get('defaultDescription') ?? ''),
      defaultOgImage: String(formData.get('defaultOgImage') ?? ''),
      robotsMeta: String(formData.get('robotsMeta') ?? ''),
      robotsTxt: String(formData.get('robotsTxt') ?? ''),
      contentRights: String(formData.get('contentRights') ?? ''),
      cookieDomain: String(formData.get('cookieDomain') ?? ''),
      cookiePath: String(formData.get('cookiePath') ?? '/'),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save Site Chrome.'
    return { error: message }
  }

  invalidateSiteChrome()
  invalidateSiteSettings()
  revalidatePath('/', 'layout')
  revalidatePath('/robots.txt')
  revalidatePath('/app/admin/site-chrome')
  revalidatePath('/app/admin/settings')
  revalidatePath('/app/admin')
  return { ok: true }
}
