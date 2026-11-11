/**
 * Forms captcha helpers — thin re-exports of the Core security captcha port.
 * Prefer `@/core/security/captcha` for new call sites (auth, other modules).
 */
export {
  resolveFormCaptcha,
  verifyCaptchaToken,
  verifyTurnstileToken,
} from '@/core/security/captcha'
export type { ResolvedCaptcha } from '@/core/security/captcha/types'
