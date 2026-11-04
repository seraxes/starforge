import 'server-only'

import type { CaptchaPort } from './types'

type TurnstileVerifyResponse = {
  success?: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
}

function turnstileSiteKey(): string {
  return (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim()
}

function turnstileSecret(): string {
  return (process.env.TURNSTILE_SECRET_KEY ?? '').trim()
}

/**
 * Cloudflare Turnstile adapter.
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export function createTurnstileCaptcha(): CaptchaPort {
  return {
    id: 'turnstile',
    siteKey() {
      return turnstileSiteKey() || null
    },
    async verify(token, ip) {
      const secret = turnstileSecret()
      if (!secret) {
        return { ok: false, error: 'Turnstile secret is not configured.' }
      }

      const response = token.trim()
      if (!response) {
        return { ok: false, error: 'Captcha response is missing.' }
      }

      const body = new URLSearchParams()
      body.set('secret', secret)
      body.set('response', response)
      if (ip) body.set('remoteip', ip)

      try {
        const res = await fetch(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
            cache: 'no-store',
          },
        )
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
    },
  }
}
