/**
 * Mutable cookie attributes shared with Better Auth.
 * Site Chrome save updates these in-place so subsequent Set-Cookie calls
 * pick up domain/path without restarting the process (object is shared by ref).
 * `secure` tracks `shouldUseSecureCookies()` so prod HTTPS and local HTTP stay aligned.
 */

import { shouldUseSecureCookies } from '@/core/security/secure-cookies'

export type SiteChromeCookieAttributes = {
  sameSite: 'lax'
  httpOnly: true
  path: string
  secure: boolean
  /** Host-only when undefined/empty. */
  domain?: string
}

export const siteChromeCookieAttributes: SiteChromeCookieAttributes = {
  sameSite: 'lax',
  httpOnly: true,
  path: '/',
  secure: shouldUseSecureCookies(),
}

export function applySiteChromeCookieAttributes(input: {
  cookieDomain?: string
  cookiePath?: string
}): void {
  // Re-sync Secure each apply (env can change across restarts; URL is process env).
  siteChromeCookieAttributes.secure = shouldUseSecureCookies()
  const path = (input.cookiePath ?? '/').trim() || '/'
  siteChromeCookieAttributes.path = path.startsWith('/') ? path : `/${path}`
  const domain = (input.cookieDomain ?? '').trim()
  if (domain) {
    siteChromeCookieAttributes.domain = domain
  } else {
    delete siteChromeCookieAttributes.domain
  }
}
