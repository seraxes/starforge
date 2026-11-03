/**
 * Cookie consent helpers (SF-131 / product:consent).
 * Policy copy lives on Site Chrome; visitor choice is the sf-consent cookie.
 */

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
