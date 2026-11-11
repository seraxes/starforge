/**
 * product:redirects Node proxy hook.
 * Codegen loads `handleRedirectProxy` into `runProxyHooks`.
 * Matching rules are unchanged from the former `src/proxy.ts` `maybeRedirect`.
 */
import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'

import { DEFAULT_LOCALE, stripLocalePrefix } from '@/core/i18n'
import { getLocalizationSettings } from '@/core/localization/store'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { normalizeRedirectFromPath, resolveLocaleAwareRedirectPath } from './paths'
import { lookupEnabledRedirect } from './store'

/**
 * Register Localization admin locale codes so `stripLocalePrefix` drops
 * admin-added prefixes. Same side effect the proxy used before lookup.
 */
async function ensurePublicLocalesRegistered(): Promise<void> {
  try {
    const { registerPublicLocaleCodes } = await import('@/core/i18n/locales')
    const settings = await getLocalizationSettings()
    registerPublicLocaleCodes(settings.localeCatalog.map((entry) => entry.code))
  } catch {
    // fail open to bootstrap locales
  }
}

function isRedirectLookupExemptPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true
  if (pathname.startsWith('/cms')) return true
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname === '/sitemap.xml' || pathname.startsWith('/sitemap')) return true
  if (pathname === '/robots.txt') return true
  if (pathname === '/manifest.webmanifest') return true
  if (pathname === '/sw.js' || pathname.startsWith('/sw.js')) return true
  return false
}

/**
 * In-process lookup (no internal HTTP hop).
 * Match stored paths without locale; re-prefix the destination with the
 * request locale. Fail-open when the module is off or the store errors.
 */
export async function handleRedirectProxy(
  request: NextRequest,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  if (isRedirectLookupExemptPath(pathname)) return null

  try {
    const settings = await getSiteSettings()
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) return null

    await ensurePublicLocalesRegistered()
    const { locale, pathname: barePath } = stripLocalePrefix(pathname)
    const fromPath = normalizeRedirectFromPath(barePath)
    if (!fromPath) return null
    const hit = await lookupEnabledRedirect(fromPath)
    if (!hit) return null

    const status =
      hit.status === 301 || hit.status === 302 || hit.status === 307 || hit.status === 308
        ? hit.status
        : 301

    let destination: URL
    if (/^https?:\/\//i.test(hit.to)) {
      destination = new URL(hit.to)
    } else {
      destination = request.nextUrl.clone()
      destination.pathname = resolveLocaleAwareRedirectPath(
        hit.to,
        locale ?? DEFAULT_LOCALE,
      )
      destination.search = ''
      destination.hash = ''
    }

    if (
      destination.origin === request.nextUrl.origin &&
      destination.pathname === pathname
    ) {
      return null
    }

    return NextResponse.redirect(destination, status)
  } catch {
    return null
  }
}
