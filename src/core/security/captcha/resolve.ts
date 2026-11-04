import 'server-only'

import { getSiteChrome } from '@/core/site-chrome'

import { resolveFromProvider } from './policy'
import { createNoneCaptcha, createUnwiredCaptchaStub, isStubProviderId } from './stubs'
import { createTurnstileCaptcha } from './turnstile'
import type {
  CaptchaPort,
  CaptchaProviderId,
  CaptchaSurface,
  ResolvedCaptcha,
} from './types'

export { resolveFromProvider } from './policy'

/**
 * Resolve the CaptchaPort for a stored provider id.
 * Unwired vendors are stubs that fail closed on verify.
 */
export function getCaptchaProvider(provider: CaptchaProviderId): CaptchaPort {
  if (provider === 'turnstile') return createTurnstileCaptcha()
  if (isStubProviderId(provider)) return createUnwiredCaptchaStub(provider)
  return createNoneCaptcha()
}

/**
 * Site Settings → Security surface policy.
 * - forms: captchaEnabled (site default; forms still opt in via particle / field)
 * - register: captchaOnRegister
 * - auth-recovery: captchaOnAuthRecovery (forgot password / username, magic link, email OTP request)
 */
export async function resolveCaptchaForSurface(
  surface: CaptchaSurface,
): Promise<ResolvedCaptcha> {
  const chrome = await getSiteChrome()
  const provider = chrome.captchaProvider

  let surfaceOn = false
  if (surface === 'forms') surfaceOn = chrome.captchaEnabled
  else if (surface === 'register') surfaceOn = chrome.captchaOnRegister
  else if (surface === 'auth-recovery') surfaceOn = chrome.captchaOnAuthRecovery

  if (!surfaceOn || provider === 'none') {
    return { required: false, provider: 'none', siteKey: null }
  }

  return resolveFromProvider(provider, true)
}

/**
 * Resolve captcha for a Form particle / definition.
 * Enforced when the form opts into the site default **or** places a `captcha`
 * field on the canvas. Site captcha off → not required (field stays idle).
 */
export async function resolveFormCaptcha(options: {
  useSiteCaptchaDefault: boolean
  /** Definition includes a captcha field — still uses site Security config. */
  hasCaptchaField?: boolean
}): Promise<ResolvedCaptcha> {
  if (!options.useSiteCaptchaDefault && !options.hasCaptchaField) {
    return { required: false, provider: 'none', siteKey: null }
  }

  const chrome = await getSiteChrome()
  if (!chrome.captchaEnabled || chrome.captchaProvider === 'none') {
    return { required: false, provider: 'none', siteKey: null }
  }

  return resolveFromProvider(chrome.captchaProvider, true)
}

/**
 * Verify a captcha token with the active adapter for `provider`.
 */
export async function verifyCaptchaToken(options: {
  provider: CaptchaProviderId
  token: string
  remoteip?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  if (options.provider === 'none') return { ok: true }
  return getCaptchaProvider(options.provider).verify(
    options.token,
    options.remoteip,
  )
}

/** @deprecated Prefer verifyCaptchaToken({ provider: 'turnstile', … }). */
export async function verifyTurnstileToken(options: {
  token: string
  remoteip?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  return verifyCaptchaToken({
    provider: 'turnstile',
    token: options.token,
    remoteip: options.remoteip,
  })
}
