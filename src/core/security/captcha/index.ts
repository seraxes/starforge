/**
 * Captcha security port — provider adapters + resolve helpers.
 *
 * **Client components** may import:
 * - `@/core/security/captcha/types` (types only)
 * - `@/core/security/captcha/providers` (wired provider list)
 * - `@/core/security/captcha/TurnstileWidget`
 *
 * Do **not** import this barrel from client components — resolve/verify are server-only.
 */

export {
  ALL_CAPTCHA_PROVIDER_IDS,
  CAPTCHA_PROVIDERS,
  isCaptchaProvider,
  isWiredCaptchaProvider,
} from './providers'
export { enforceCaptchaFromFormData } from './enforce'
export {
  getCaptchaProvider,
  resolveCaptchaForSurface,
  resolveFormCaptcha,
  resolveFromProvider,
  verifyCaptchaToken,
  verifyTurnstileToken,
} from './resolve'
export type {
  CaptchaPort,
  CaptchaProvider,
  CaptchaProviderId,
  CaptchaSurface,
  ResolvedCaptcha,
} from './types'
