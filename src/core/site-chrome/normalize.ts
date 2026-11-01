import {
  DEFAULT_OFFLINE_MESSAGE,
  DEFAULT_ROBOTS_META,
  DEFAULT_ROBOTS_TXT,
  DEFAULT_SITE_CHROME,
  DEFAULT_SITE_CHROME_NAME,
  isCaptchaProvider,
} from './defaults'
import type { SiteChromeDocument } from './types'

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Normalize unknown JSON into a SiteChromeDocument. */
export function normalizeSiteChrome(raw: unknown): SiteChromeDocument {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  const siteName = asString(src.siteName).trim() || DEFAULT_SITE_CHROME_NAME
  const cookiePathRaw = asString(src.cookiePath, DEFAULT_SITE_CHROME.cookiePath).trim()
  const cookiePath = cookiePathRaw.startsWith('/') ? cookiePathRaw : `/${cookiePathRaw}`

  const captchaProvider = isCaptchaProvider(src.captchaProvider)
    ? src.captchaProvider
    : DEFAULT_SITE_CHROME.captchaProvider

  return {
    version: 1,
    offlineEnabled: asBool(src.offlineEnabled, false),
    offlineMessage:
      asString(src.offlineMessage).trim() || DEFAULT_OFFLINE_MESSAGE,
    captchaEnabled: asBool(src.captchaEnabled, false),
    captchaProvider,
    siteName,
    defaultDescription: asString(src.defaultDescription).trim(),
    defaultOgImage: asString(src.defaultOgImage).trim(),
    robotsMeta: asString(src.robotsMeta).trim() || DEFAULT_ROBOTS_META,
    robotsTxt: asString(src.robotsTxt).trim() || DEFAULT_ROBOTS_TXT,
    contentRights: asString(src.contentRights).trim(),
    cookieDomain: asString(src.cookieDomain).trim(),
    cookiePath: cookiePath || '/',
  }
}

export function parseSiteChromeJson(json: string): SiteChromeDocument | null {
  try {
    return normalizeSiteChrome(JSON.parse(json) as unknown)
  } catch {
    return null
  }
}

export function serializeSiteChrome(chrome: SiteChromeDocument): string {
  return JSON.stringify(normalizeSiteChrome(chrome))
}
