import 'server-only'

import { getSiteChrome } from '@/core/site-chrome'
import type { CaptchaProvider } from '@/core/site-chrome/types'

export type ResolvedCaptcha = {
  /** Whether this form instance should challenge the visitor. */
  required: boolean
  provider: CaptchaProvider
  /** Public site key (Turnstile) when required + provider is turnstile. */
  siteKey: string | null
  /** Human-readable reason when required but misconfigured. */
  misconfiguredReason?: string
}

/**
 * Resolve captcha for a Form particle.
 * Site Chrome owns enable + provider; keys stay in env.
 */
export async function resolveFormCaptcha(options: {
  useSiteCaptchaDefault: boolean
}): Promise<ResolvedCaptcha> {
  if (!options.useSiteCaptchaDefault) {
    return { required: false, provider: 'none', siteKey: null }
  }

  const chrome = await getSiteChrome()
  if (!chrome.captchaEnabled || chrome.captchaProvider === 'none') {
    return { required: false, provider: 'none', siteKey: null }
  }

  const provider = chrome.captchaProvider

  if (provider === 'turnstile') {
    const siteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim()
    const secret = (process.env.TURNSTILE_SECRET_KEY ?? '').trim()
    if (!siteKey || !secret) {
      return {
        required: true,
        provider,
        siteKey: siteKey || null,
        misconfiguredReason:
          'Turnstile is enabled in Site Chrome but NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY are not set.',
      }
    }
    return { required: true, provider, siteKey }
  }

  // reCAPTCHA / hCaptcha — stub until wired; treat as not enforced.
  return {
    required: false,
    provider,
    siteKey: null,
    misconfiguredReason: `${provider} is selected but not implemented yet — form captcha skipped.`,
  }
}

type TurnstileVerifyResponse = {
  success?: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
}

/**
 * Server-side Cloudflare Turnstile verification.
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyTurnstileToken(options: {
  token: string
  remoteip?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const secret = (process.env.TURNSTILE_SECRET_KEY ?? '').trim()
  if (!secret) {
    return { ok: false, error: 'Turnstile secret is not configured.' }
  }

  const token = options.token.trim()
  if (!token) {
    return { ok: false, error: 'Captcha response is missing.' }
  }

  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (options.remoteip) body.set('remoteip', options.remoteip)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    })
    if (!res.ok) {
      return { ok: false, error: 'Captcha verification request failed.' }
    }
    const data = (await res.json()) as TurnstileVerifyResponse
    if (!data.success) {
      const codes = data['error-codes']?.join(', ') || 'unknown'
      return { ok: false, error: `Captcha failed (${codes}).` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Captcha verification unavailable.' }
  }
}
