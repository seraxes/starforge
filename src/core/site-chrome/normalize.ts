import { DEFAULT_LOCALE, isValidLocaleCode, normalizeLocaleCode } from '@/core/i18n/locales'
import { normalizeLocaleCatalog } from '@/core/localization/normalize'

import {
  DEFAULT_AUTH_POST_LOGIN_URL,
  DEFAULT_AUTH_POST_LOGOUT_URL,
  DEFAULT_AUTH_POST_REGISTER_URL,
  DEFAULT_CONSENT_MESSAGE,
  DEFAULT_CONSENT_PRIVACY_LINK_LABEL,
  DEFAULT_OFFLINE_LAYOUT_ID,
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

/** Same-origin relative path only (blocks open redirects). */
function asSafeRelativePath(value: unknown, fallback: string): string {
  const raw = asString(value).trim()
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback
  }
  return raw
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
    offlineLayoutId:
      asString(src.offlineLayoutId).trim() || DEFAULT_OFFLINE_LAYOUT_ID,
    captchaEnabled: asBool(src.captchaEnabled, false),
    captchaProvider,
    captchaOnRegister: asBool(src.captchaOnRegister, false),
    captchaOnAuthRecovery: asBool(src.captchaOnAuthRecovery, false),
    authForgotPasswordEnabled: asBool(
      src.authForgotPasswordEnabled,
      DEFAULT_SITE_CHROME.authForgotPasswordEnabled,
    ),
    authForgotUsernameEnabled: asBool(
      src.authForgotUsernameEnabled,
      DEFAULT_SITE_CHROME.authForgotUsernameEnabled,
    ),
    authMagicLinkEnabled: asBool(
      src.authMagicLinkEnabled,
      DEFAULT_SITE_CHROME.authMagicLinkEnabled,
    ),
    authEmailOtpEnabled: asBool(
      src.authEmailOtpEnabled,
      DEFAULT_SITE_CHROME.authEmailOtpEnabled,
    ),
    authRememberMeEnabled: asBool(
      src.authRememberMeEnabled,
      DEFAULT_SITE_CHROME.authRememberMeEnabled,
    ),
    authTwoFactorEnabled: asBool(
      src.authTwoFactorEnabled,
      DEFAULT_SITE_CHROME.authTwoFactorEnabled,
    ),
    authRequireEmailVerification: asBool(
      src.authRequireEmailVerification,
      DEFAULT_SITE_CHROME.authRequireEmailVerification,
    ),
    authPostLoginUrl: asSafeRelativePath(
      src.authPostLoginUrl,
      DEFAULT_AUTH_POST_LOGIN_URL,
    ),
    authPostRegisterUrl: asSafeRelativePath(
      src.authPostRegisterUrl,
      DEFAULT_AUTH_POST_REGISTER_URL,
    ),
    authPostLogoutUrl: asSafeRelativePath(
      src.authPostLogoutUrl,
      DEFAULT_AUTH_POST_LOGOUT_URL,
    ),
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
