import { DEFAULT_LOCALE, isValidLocaleCode, normalizeLocaleCode } from '@/core/i18n/locales'
import { normalizeLocaleCatalog } from '@/core/localization/normalize'

import {
  DEFAULT_CONSENT_MESSAGE,
  DEFAULT_CONSENT_PRIVACY_LINK_LABEL,
  DEFAULT_OFFLINE_MESSAGE,
  DEFAULT_ROBOTS_META,
  DEFAULT_ROBOTS_TXT,
  DEFAULT_SITE_CHROME,
  DEFAULT_SITE_CHROME_NAME,
  isCaptchaProvider,
  isMailProvider,
} from './defaults'
import type { SiteChromeDocument } from './types'

function normalizeLocalesEnabled(
  value: unknown,
  catalogCodes: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SITE_CHROME.localesEnabled]
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of value) {
    const code = normalizeLocaleCode(typeof entry === 'string' ? entry : '')
    if (!catalogCodes.has(code) || seen.has(code)) continue
    seen.add(code)
    out.push(code)
  }
  return out.length > 0 ? out : [...DEFAULT_SITE_CHROME.localesEnabled]
}

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

  const emailProvider = isMailProvider(src.emailProvider)
    ? src.emailProvider
    : DEFAULT_SITE_CHROME.emailProvider

  const localeCatalog = normalizeLocaleCatalog(src.localeCatalog)
  const catalogCodes = new Set(localeCatalog.map((e) => e.code))
  const localesEnabled = normalizeLocalesEnabled(src.localesEnabled, catalogCodes)
  let defaultLocale = isValidLocaleCode(src.defaultLocale)
    ? normalizeLocaleCode(src.defaultLocale)
    : DEFAULT_LOCALE
  if (!localesEnabled.includes(defaultLocale)) {
    defaultLocale = localesEnabled[0] || DEFAULT_LOCALE
  }

  return {
    version: 1,
    offlineEnabled: asBool(src.offlineEnabled, false),
    offlineMessage:
      asString(src.offlineMessage).trim() || DEFAULT_OFFLINE_MESSAGE,
    captchaEnabled: asBool(src.captchaEnabled, false),
    captchaProvider,
    captchaOnRegister: asBool(src.captchaOnRegister, false),
    captchaOnAuthRecovery: asBool(src.captchaOnAuthRecovery, false),
    emailEnabled: asBool(src.emailEnabled, false),
    emailProvider,
    emailFrom: asString(src.emailFrom).trim(),
    siteName,
    defaultDescription: asString(src.defaultDescription).trim(),
    defaultOgImage: asString(src.defaultOgImage).trim(),
    robotsMeta: asString(src.robotsMeta).trim() || DEFAULT_ROBOTS_META,
    robotsTxt: asString(src.robotsTxt).trim() || DEFAULT_ROBOTS_TXT,
    contentRights: asString(src.contentRights).trim(),
    cookieDomain: asString(src.cookieDomain).trim(),
    cookiePath: cookiePath || '/',
    consentMessage:
      asString(src.consentMessage).trim() || DEFAULT_CONSENT_MESSAGE,
    consentPrivacyUrl: asString(src.consentPrivacyUrl).trim(),
    consentPrivacyLinkLabel:
      asString(src.consentPrivacyLinkLabel).trim() ||
      DEFAULT_CONSENT_PRIVACY_LINK_LABEL,
    localeCatalog,
    localesEnabled,
    defaultLocale,
    localeFallback: asBool(src.localeFallback, DEFAULT_SITE_CHROME.localeFallback),
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

/**
 * True when stored Chrome JSON is missing localization fields (pre-i18n P0 rows,
 * pre-Localization-page rows lacking `localeFallback` / `localeCatalog`, or
 * stale cache payloads). Soft-heal callers rewrite defaults via normalize.
 */
export function siteChromeDocumentNeedsLocaleHeal(json: string): boolean {
  try {
    const raw = JSON.parse(json) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
    const src = raw as Record<string, unknown>
    if (!Array.isArray(src.localesEnabled)) return true
    if (!Array.isArray(src.localeCatalog)) return true
    if (typeof src.defaultLocale !== 'string' || !src.defaultLocale.trim()) return true
    if (typeof src.localeFallback !== 'boolean') return true
    return false
  } catch {
    return true
  }
}
