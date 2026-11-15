/**
 * Cookie consent helpers (SF-131).
 * Host policy lives here. The package banner keeps a separate copy and does
 * not import Core. Policy copy lives on Site Chrome; the choice is the cookie.
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
