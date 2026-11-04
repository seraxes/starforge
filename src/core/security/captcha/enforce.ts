import 'server-only'

import { clientIp } from '@/core/security/client-ip'

import { resolveCaptchaForSurface, verifyCaptchaToken } from './resolve'
import type { CaptchaSurface } from './types'

type HeaderReader = { get(name: string): string | null }

/**
 * Enforce Site Settings → Security captcha for an auth (or other) surface.
 * No-op when the surface toggle is off or provider is None.
 */
export async function enforceCaptchaFromFormData(
  surface: CaptchaSurface,
  formData: FormData,
  requestHeaders: HeaderReader,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const captcha = await resolveCaptchaForSurface(surface)
  if (!captcha.required) return { ok: true }

  if (captcha.misconfiguredReason && !captcha.siteKey) {
    return {
      ok: false,
      error: 'Captcha is misconfigured. Please contact the site administrator.',
    }
  }

  const token = String(formData.get('cf-turnstile-response') ?? '').trim()
  // Next `headers()` is structurally compatible with the Web Headers getter used by clientIp.
  const ip = clientIp(requestHeaders as Headers)
  const verified = await verifyCaptchaToken({
    provider: captcha.provider,
    token,
    remoteip: ip,
  })
  if (!verified.ok) {
    return { ok: false, error: verified.error || 'Captcha verification failed.' }
  }
  return { ok: true }
}
