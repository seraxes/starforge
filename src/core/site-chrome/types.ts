/**
 * Site Chrome document — site-wide policy & metadata (SF-43).
 * Not Page Settings (per-page) and not Modules toggles.
 */

import type { MailProvider } from '@/core/mail/types'
import type { CaptchaProviderId } from '@/core/security/captcha/types'

/** Captcha provider id — owned by core/security/captcha; stored on Chrome JSON. */
export type CaptchaProvider = CaptchaProviderId

/** Re-export for Site Chrome consumers — secrets stay in env. */
export type { MailProvider }

export type SiteChromeDocument = {
  version: 1
  /** When true, public site shows the offline message (admins still pass). */
  offlineEnabled: boolean
  offlineMessage: string
  /**
   * Forms surface default (enable + provider; keys in env).
   * Edited under Site Settings → Security; kept here for storage continuity.
   */
  captchaEnabled: boolean
  captchaProvider: CaptchaProvider
  /** Require captcha on /register when provider is wired. */
  captchaOnRegister: boolean
  /**
   * Require captcha on auth recovery email sends:
   * forgot password / username, magic link, email OTP request.
   */
  captchaOnAuthRecovery: boolean
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
  /**
   * Consent banner copy (product:consent). Empty → module default message.
   * Visitor choice is stored in the sf-consent cookie — not here.
   */
  consentMessage: string
  /** Optional privacy / cookie policy page URL (absolute or site-relative). */
  consentPrivacyUrl: string
  /** Link label for consentPrivacyUrl. */
  consentPrivacyLinkLabel: string
  /**
   * Localization settings — edited under `/admin/localization` (not this form).
   * Storage stays on Chrome JSON for continuity with the P0 stub; UI ownership
   * moved off Chrome. Routing still uses Core i18n catalog (`src/core/i18n`);
   * enable-list limiting of prefixes lands later. Payload `localization` in
   * `payload.config.ts` stays code/env for now (document sync, not runtime).
   */
  localesEnabled: string[]
  defaultLocale: string
  /** When true, missing locale content falls back to defaultLocale (Payload + UI). */
  localeFallback: boolean
}

export type SiteChromeLoadSource = 'database' | 'default'

export type SiteChromeLoadResult = {
  chrome: SiteChromeDocument
  source: SiteChromeLoadSource
  isFallback: boolean
}
