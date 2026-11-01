/**
 * Mutable cookie attributes shared with Better Auth.
 * Site Chrome save updates these in-place so subsequent Set-Cookie calls
 * pick up domain/path without restarting the process (object is shared by ref).
 */

export type SiteChromeCookieAttributes = {
  sameSite: 'lax'
  httpOnly: true
  path: string
  secure: false
  /** Host-only when undefined/empty. */
  domain?: string
}

export const siteChromeCookieAttributes: SiteChromeCookieAttributes = {
  sameSite: 'lax',
  httpOnly: true,
  path: '/',
  secure: false,
}

export function applySiteChromeCookieAttributes(input: {
  cookieDomain?: string
  cookiePath?: string
}): void {
  const path = (input.cookiePath ?? '/').trim() || '/'
  siteChromeCookieAttributes.path = path.startsWith('/') ? path : `/${path}`
  const domain = (input.cookieDomain ?? '').trim()
  if (domain) {
    siteChromeCookieAttributes.domain = domain
  } else {
    delete siteChromeCookieAttributes.domain
  }
}
