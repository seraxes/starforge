/**
 * Shared Captcha port (design-security §7).
 * Site Settings → Security owns enable + provider + surface toggles (non-secret).
 * Secrets stay in env / Environment.
 */

/** Stored provider id (Site Chrome JSON). */
export type CaptchaProviderId = 'none' | 'turnstile' | 'recaptcha' | 'hcaptcha'

/**
 * @deprecated Prefer CaptchaProviderId — kept as alias for Site Chrome / Forms types.
 */
export type CaptchaProvider = CaptchaProviderId

/** Surfaces that may require a captcha challenge. */
export type CaptchaSurface = 'forms' | 'register' | 'auth-recovery'

/**
 * Provider adapter — Turnstile is wired; reCAPTCHA / hCaptcha are safe stubs
 * (verify fails closed; never skip when selected).
 */
export interface CaptchaPort {
  readonly id: CaptchaProviderId
  /** Public site key for the widget, or null when unavailable. */
  siteKey(): string | null
  verify(token: string, ip?: string | null): Promise<{ ok: boolean; error?: string }>
}

/** Resolved challenge for a surface / form instance (safe to pass to client widgets). */
export type ResolvedCaptcha = {
  required: boolean
  provider: CaptchaProviderId
  siteKey: string | null
  misconfiguredReason?: string
}
