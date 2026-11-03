/**
 * Visitor cookie consent preferences (SF-131 / product:consent).
 * Stored in a first-party cookie — no DB table.
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
