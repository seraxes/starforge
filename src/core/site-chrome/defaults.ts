import { DEFAULT_LOCALE, LOCALES } from '@/core/i18n/locales'
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
  captchaEnabled: false,
  captchaProvider: 'none',
  captchaOnRegister: false,
  captchaOnAuthRecovery: false,
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
  localesEnabled: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
}
