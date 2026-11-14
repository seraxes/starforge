import { DEFAULT_LOCALE, DEFAULT_LOCALE_CATALOG, LOCALES } from '@/core/i18n/locales'
import {
  MAIL_PROVIDERS,
  isMailProvider,
  type MailProvider,
} from '@/core/mail/types'
import {
  CAPTCHA_PROVIDERS,
  isCaptchaProvider,
  isWiredCaptchaProvider,
} from '@/core/security/captcha/providers'

import type { SiteChromeDocument } from './types'

export const DEFAULT_SITE_CHROME_NAME = 'Starforge'

export const DEFAULT_ROBOTS_META = 'index, follow'

export const DEFAULT_ROBOTS_TXT = `User-agent: *
Allow: /

Sitemap: /sitemap.xml
`

export const DEFAULT_OFFLINE_MESSAGE =
  'This site is temporarily offline. Please check back soon.'

/** Default Site Chrome offline outline — Pastel pack Offline seed. */
export const DEFAULT_OFFLINE_LAYOUT_ID = 'starforge-pastel-offline'

export const DEFAULT_AUTH_POST_LOGIN_URL = '/'
export const DEFAULT_AUTH_POST_REGISTER_URL = '/'
/** Offline-allowed default — avoids gated `/` after sign-out while the site is offline. */
export const DEFAULT_AUTH_POST_LOGOUT_URL = '/login'

export const DEFAULT_CONSENT_MESSAGE =
  'We use cookies for essential site functions and optional analytics. You can accept all cookies or continue with essential cookies only.'

export const DEFAULT_CONSENT_PRIVACY_LINK_LABEL = 'Privacy policy'

/** Re-export Settings select list from the security captcha port (wired only). */
export { CAPTCHA_PROVIDERS, isCaptchaProvider, isWiredCaptchaProvider }

export { MAIL_PROVIDERS, isMailProvider }
export type { MailProvider }

export const DEFAULT_SITE_CHROME: SiteChromeDocument = {
  version: 1,
  offlineEnabled: false,
  offlineMessage: DEFAULT_OFFLINE_MESSAGE,
  offlineLayoutId: DEFAULT_OFFLINE_LAYOUT_ID,
  captchaEnabled: false,
  captchaProvider: 'none',
  captchaOnRegister: false,
  captchaOnAuthRecovery: false,
  authForgotPasswordEnabled: true,
  authForgotUsernameEnabled: true,
  authMagicLinkEnabled: true,
  authEmailOtpEnabled: true,
  authRememberMeEnabled: true,
  authTwoFactorEnabled: true,
  authRequireEmailVerification: false,
  authPostLoginUrl: DEFAULT_AUTH_POST_LOGIN_URL,
  authPostRegisterUrl: DEFAULT_AUTH_POST_REGISTER_URL,
  authPostLogoutUrl: DEFAULT_AUTH_POST_LOGOUT_URL,
  emailEnabled: false,
  emailProvider: 'console',
  emailFrom: '',
  siteName: DEFAULT_SITE_CHROME_NAME,
  defaultDescription: '',
  defaultOgImage: '',
  robotsMeta: DEFAULT_ROBOTS_META,
  robotsTxt: DEFAULT_ROBOTS_TXT,
  contentRights: '',
  cookieDomain: '',
  cookiePath: '/',
  consentMessage: DEFAULT_CONSENT_MESSAGE,
  consentPrivacyUrl: '',
  consentPrivacyLinkLabel: DEFAULT_CONSENT_PRIVACY_LINK_LABEL,
  localeCatalog: DEFAULT_LOCALE_CATALOG.map((e) => ({ ...e })),
  localesEnabled: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localeFallback: true,
}
