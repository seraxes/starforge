import type { CaptchaProviderId } from './types'

/**
 * Providers shown in Site Settings → Security.
 * Unwired vendors are intentionally omitted (design-security §7).
 */
export const CAPTCHA_PROVIDERS: Array<{ value: CaptchaProviderId; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'turnstile', label: 'Cloudflare Turnstile' },
]

/** Every known id (normalize / legacy storage); includes unwired stubs. */
export const ALL_CAPTCHA_PROVIDER_IDS: CaptchaProviderId[] = [
  'none',
  'turnstile',
  'recaptcha',
  'hcaptcha',
]

const ALL_SET = new Set<CaptchaProviderId>(ALL_CAPTCHA_PROVIDER_IDS)
const WIRED_SET = new Set<CaptchaProviderId>(CAPTCHA_PROVIDERS.map((p) => p.value))

export function isCaptchaProvider(value: unknown): value is CaptchaProviderId {
  return typeof value === 'string' && ALL_SET.has(value as CaptchaProviderId)
}

/** True for None / Turnstile — selectable in Settings. */
export function isWiredCaptchaProvider(value: CaptchaProviderId): boolean {
  return WIRED_SET.has(value)
}
