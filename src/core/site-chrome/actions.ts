'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { invalidateSiteChrome, invalidateSiteSettings } from '@/core/content/revalidate'

import {
  CAPTCHA_PROVIDERS,
  MAIL_PROVIDERS,
  isCaptchaProvider,
  isMailProvider,
} from './defaults'
import { saveSiteChrome } from './store'
import type { CaptchaProvider, MailProvider } from './types'

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
    return { error: 'Sign in as a Starforge app admin to edit Chrome.' }
  }

  const emailRaw = String(formData.get('emailProvider') ?? 'console').trim()
  const emailProvider: MailProvider = isMailProvider(emailRaw) ? emailRaw : 'console'
  if (!MAIL_PROVIDERS.some((p) => p.value === emailProvider)) {
    return { error: 'Unknown email provider.' }
  }

  try {
    // Captcha lives under Site Settings → Security (preserve existing values).
    await saveSiteChrome({
      offlineEnabled: parseBool(formData, 'offlineEnabled'),
      offlineMessage: String(formData.get('offlineMessage') ?? ''),
      offlineLayoutId: String(formData.get('offlineLayoutId') ?? '').trim(),
      emailEnabled: parseBool(formData, 'emailEnabled'),
      emailProvider,
      emailFrom: String(formData.get('emailFrom') ?? ''),
      siteName: String(formData.get('siteName') ?? ''),
      defaultDescription: String(formData.get('defaultDescription') ?? ''),
      defaultOgImage: String(formData.get('defaultOgImage') ?? ''),
      robotsMeta: String(formData.get('robotsMeta') ?? ''),
      robotsTxt: String(formData.get('robotsTxt') ?? ''),
      contentRights: String(formData.get('contentRights') ?? ''),
      cookieDomain: String(formData.get('cookieDomain') ?? ''),
      cookiePath: String(formData.get('cookiePath') ?? '/'),
      consentMessage: String(formData.get('consentMessage') ?? ''),
      consentPrivacyUrl: String(formData.get('consentPrivacyUrl') ?? ''),
      consentPrivacyLinkLabel: String(formData.get('consentPrivacyLinkLabel') ?? ''),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save Chrome.'
    return { error: message }
  }

  await invalidateSiteChrome()
  await invalidateSiteSettings()
  revalidatePath('/', 'layout')
  revalidatePath('/robots.txt')
  revalidatePath('/admin/site-chrome')
  revalidatePath('/admin/settings')
  revalidatePath('/admin')
  return { ok: true }
}

/**
 * Site Settings → Security: captcha enable + provider + auth surfaces.
 * Storage remains `sf_site_chrome` (no migration); Site Chrome form no longer edits these.
 * Only wired providers (None / Turnstile) are accepted — unwired stubs stay hidden.
 * Honeypot / rate-limit / headers stubs on the Security page are UI-only until persisted.
 */
export async function updateSecurityCaptchaAction(
  _prev: SiteChromeActionState,
  formData: FormData,
): Promise<SiteChromeActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit captcha settings.' }
  }

  const captchaRaw = String(formData.get('captchaProvider') ?? 'none').trim()
  const captchaProvider: CaptchaProvider = isCaptchaProvider(captchaRaw)
    ? captchaRaw
    : 'none'

  // Reject unwired providers (recaptcha/hcaptcha) — fail closed at the admin boundary.
  if (!CAPTCHA_PROVIDERS.some((p) => p.value === captchaProvider)) {
    return {
      error:
        'Unknown or unwired captcha provider. Choose None or Cloudflare Turnstile.',
    }
  }

  try {
    await saveSiteChrome({
      captchaEnabled: parseBool(formData, 'captchaEnabled'),
      captchaProvider,
      captchaOnRegister: parseBool(formData, 'captchaOnRegister'),
      captchaOnAuthRecovery: parseBool(formData, 'captchaOnAuthRecovery'),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save captcha settings.'
    return { error: message }
  }

  await invalidateSiteChrome()
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings/security')
  revalidatePath('/admin/forms')
  revalidatePath('/register')
  revalidatePath('/forgot-password')
  revalidatePath('/forgot-username')
  revalidatePath('/login')
  revalidatePath('/admin')
  return { ok: true }
}

/** @deprecated Prefer updateSecurityCaptchaAction (Integrations → Security rename). */
export const updateCaptchaIntegrationAction = updateSecurityCaptchaAction
