import 'server-only'

import type { CaptchaPort, CaptchaProviderId } from './types'

/**
 * Unwired provider stubs — fail closed.
 * Never return success; never expose a site key (no public challenge).
 */
export function createUnwiredCaptchaStub(id: 'recaptcha' | 'hcaptcha'): CaptchaPort {
  const label = id === 'recaptcha' ? 'Google reCAPTCHA' : 'hCaptcha'
  return {
    id,
    siteKey() {
      return null
    },
    async verify() {
      return {
        ok: false,
        error: `${label} is not wired yet. Choose Turnstile in Settings → Security, or set provider to None.`,
      }
    },
  }
}

export function createNoneCaptcha(): CaptchaPort {
  return {
    id: 'none',
    siteKey() {
      return null
    },
    async verify() {
      return { ok: true }
    },
  }
}

export function isStubProviderId(
  id: CaptchaProviderId,
): id is 'recaptcha' | 'hcaptcha' {
  return id === 'recaptcha' || id === 'hcaptcha'
}
