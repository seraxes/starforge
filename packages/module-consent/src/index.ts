export { ConsentBanner, type ConsentBannerProps } from './ConsentBanner'
export {
  buildConsentPreferences,
  hasAnalyticsConsent,
  parseConsentPreferences,
  readConsentFromCookieHeader,
  readConsentFromDocumentCookie,
  serializeConsentPreferences,
  writeConsentCookie,
} from './cookie'
export {
  CONSENT_COOKIE_MAX_AGE_SECONDS,
  CONSENT_COOKIE_NAME,
  CONSENT_EVENT,
  type ConsentCategory,
  type ConsentChangeDetail,
  type ConsentPreferences,
} from './types'
