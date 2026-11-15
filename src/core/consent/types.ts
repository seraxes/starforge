/**
 * Host copy of the sf-consent cookie contract.
 * `packages/module-consent` keeps its own copy for the banner and does not
 * import Core. Keep the cookie name, event, and preference shape aligned.
 */

export const CONSENT_COOKIE_NAME = 'sf-consent' as const

/** Cookie max-age: 1 year. */
export const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export type ConsentPreferences = {
  /** Schema version for forward-compatible parses. */
  v: 1
  /** Always true — essential cookies (session, consent itself). */
  necessary: true
  /** Optional measurement (atom:analytics). */
  analytics: boolean
  /** ISO timestamp when the visitor last chose. */
  decidedAt: string
}

export type ConsentCategory = 'necessary' | 'analytics'

export const CONSENT_EVENT = 'sf-consent-change' as const

export type ConsentChangeDetail = {
  preferences: ConsentPreferences
}
