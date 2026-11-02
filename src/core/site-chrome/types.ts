/**
 * Site Chrome document — site-wide policy & metadata (SF-43).
 * Not Page Settings (per-page) and not Modules toggles.
 */

import type { MailProvider } from '@/core/mail/types'

export type CaptchaProvider = 'none' | 'turnstile' | 'recaptcha' | 'hcaptcha'

/** Re-export for Site Chrome consumers — secrets stay in env. */
export type { MailProvider }

export type SiteChromeDocument = {
  version: 1
  /** When true, public site shows the offline message (admins still pass). */
  offlineEnabled: boolean
  offlineMessage: string
  /** Default sitewide captcha for forms (enable + provider; keys in env). */
  captchaEnabled: boolean
  captchaProvider: CaptchaProvider
  /**
   * Outbound email (SF-96). Enable + provider + From only;
   * SMTP / Resend secrets stay in env.
   */
  emailEnabled: boolean
  emailProvider: MailProvider
  /** Default From address (forms / transactional). Empty → STARFORGE_MAIL_FROM. */
  emailFrom: string
  /** Public brand / default document title base. */
  siteName: string
  defaultDescription: string
  /** Absolute or site-relative URL for default Open Graph image. */
  defaultOgImage: string
  /** Default robots meta content (e.g. `index, follow`). */
  robotsMeta: string
  /** Body of `/robots.txt` (User-agent rules). */
  robotsTxt: string
  /** Copyright / rights statement (feeds Copyright particle fallback). */
  contentRights: string
  /** Session cookie Domain attribute (empty = host-only). */
  cookieDomain: string
  /** Session cookie Path attribute. */
  cookiePath: string
}

export type SiteChromeLoadSource = 'database' | 'default'

export type SiteChromeLoadResult = {
  chrome: SiteChromeDocument
  source: SiteChromeLoadSource
  isFallback: boolean
}
