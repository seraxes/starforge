import type { CaptchaProviderId, ResolvedCaptcha } from './types'

type EnvLike = Record<string, string | undefined>

function misconfiguredFor(provider: CaptchaProviderId): string {
  if (provider === 'turnstile') {
    return 'Turnstile is enabled in Settings → Security but NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY are not set.'
  }
  if (provider === 'recaptcha' || provider === 'hcaptcha') {
    return `${provider} is selected but not wired — captcha cannot be satisfied. Choose Turnstile or None in Settings → Security.`
  }
  return 'Captcha is misconfigured.'
}

/**
 * Pure resolve — no I/O. Env keys read for Turnstile misconfig detection.
 * Unwired vendors stay required (fail closed; never skip).
 */
export function resolveFromProvider(
  provider: CaptchaProviderId,
  required: boolean,
  env: EnvLike = process.env,
): ResolvedCaptcha {
  if (!required || provider === 'none') {
    return { required: false, provider: 'none', siteKey: null }
  }

  if (provider === 'recaptcha' || provider === 'hcaptcha') {
    return {
      required: true,
      provider,
      siteKey: null,
      misconfiguredReason: misconfiguredFor(provider),
    }
  }

  if (provider === 'turnstile') {
    const siteKey = (env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim()
    const secret = (env.TURNSTILE_SECRET_KEY ?? '').trim()
    if (!siteKey || !secret) {
      return {
        required: true,
        provider,
        siteKey: siteKey || null,
        misconfiguredReason: misconfiguredFor(provider),
      }
    }
    return { required: true, provider, siteKey }
  }

  return { required: false, provider: 'none', siteKey: null }
}
