/**
 * Parse / serialize the sf-consent preference cookie.
 * Client-readable (not httpOnly) so the banner and analytics gate can share it.
 */

import {
  CONSENT_COOKIE_MAX_AGE_SECONDS,
  CONSENT_COOKIE_NAME,
  type ConsentPreferences,
} from './types'

/** Prefer Secure on HTTPS pages (client); env URLs are server-only. */
function consentCookieSecure(): boolean {
  if (typeof window !== 'undefined') {
    return window.location.protocol === 'https:'
  }
  return false
}

function asBool(value: unknown): boolean {
  return value === true
}

/** Normalize unknown JSON into ConsentPreferences, or null if undecided/invalid. */
export function parseConsentPreferences(raw: unknown): ConsentPreferences | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const src = raw as Record<string, unknown>
  // Require an explicit analytics boolean — missing means undecided / legacy junk.
  if (typeof src.analytics !== 'boolean') return null
  const decidedAt =
    typeof src.decidedAt === 'string' && src.decidedAt.trim()
      ? src.decidedAt.trim()
      : new Date().toISOString()
  return {
    v: 1,
    necessary: true,
    analytics: asBool(src.analytics),
    decidedAt,
  }
}

export function serializeConsentPreferences(prefs: ConsentPreferences): string {
  return JSON.stringify({
    v: 1,
    necessary: true,
    analytics: Boolean(prefs.analytics),
    decidedAt: prefs.decidedAt || new Date().toISOString(),
  })
}

/** Build Accept-all or Essential-only preferences. */
export function buildConsentPreferences(input: {
  analytics: boolean
}): ConsentPreferences {
  return {
    v: 1,
    necessary: true,
    analytics: Boolean(input.analytics),
    decidedAt: new Date().toISOString(),
  }
}

/** Read preferences from a Cookie header value (server) or document.cookie (client). */
export function readConsentFromCookieHeader(
  cookieHeader: string | null | undefined,
): ConsentPreferences | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(`${CONSENT_COOKIE_NAME}=`)) continue
    const raw = trimmed.slice(CONSENT_COOKIE_NAME.length + 1)
    try {
      const decoded = decodeURIComponent(raw)
      return parseConsentPreferences(JSON.parse(decoded) as unknown)
    } catch {
      return null
    }
  }
  return null
}

/** Client: read from document.cookie. */
export function readConsentFromDocumentCookie(): ConsentPreferences | null {
  if (typeof document === 'undefined') return null
  return readConsentFromCookieHeader(document.cookie)
}

/**
 * Client: write the preference cookie.
 * Uses Site Chrome path when provided; Secure follows the same HTTPS policy as sessions.
 */
export function writeConsentCookie(
  prefs: ConsentPreferences,
  options?: { path?: string; domain?: string },
): void {
  if (typeof document === 'undefined') return
  const path = (options?.path ?? '/').trim() || '/'
  const secure = consentCookieSecure()
  const parts = [
    `${CONSENT_COOKIE_NAME}=${encodeURIComponent(serializeConsentPreferences(prefs))}`,
    `Path=${path.startsWith('/') ? path : `/${path}`}`,
    `Max-Age=${CONSENT_COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  const domain = (options?.domain ?? '').trim()
  if (domain) parts.push(`Domain=${domain}`)
  document.cookie = parts.join('; ')
}

/** True when analytics category is explicitly allowed. */
export function hasAnalyticsConsent(prefs: ConsentPreferences | null): boolean {
  return Boolean(prefs?.analytics)
}
