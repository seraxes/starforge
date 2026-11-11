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
   * Outline (`sf_layouts` id) used for the public offline screen.
   * Empty → Pastel offline seed id. Edited under Site Chrome.
   */
  offlineLayoutId: string
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
   * Public auth option policy (Site Settings → Auth & registration).
   * Stored on Chrome JSON (no Payload migration); UI lives under Auth.
   * When off, hide the corresponding login helpers / modes (Better Auth
   * plugins stay installed — toggles are product surface gates).
   */
  authForgotPasswordEnabled: boolean
  authForgotUsernameEnabled: boolean
  authMagicLinkEnabled: boolean
  authEmailOtpEnabled: boolean
  authRememberMeEnabled: boolean
  /** Show Account security / 2FA CTAs and allow enrollment links. */
  authTwoFactorEnabled: boolean
  /**
   * When true, Better Auth requires a verified email before password sign-in
   * and sends a verification link on register (Mailer via sendAuthMail).
   * Default off — existing sites keep signing in without a verify step.
   */
  authRequireEmailVerification: boolean
  /**
   * Default success paths after auth (Site Settings → Auth).
   * Site-relative only; `?next=` / form `next` still overrides login deep links.
   */
  authPostLoginUrl: string
  authPostRegisterUrl: string
  authPostLogoutUrl: string
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
   * moved off Chrome. Public routing / switcher / hreflang honor this catalog
   * at request time. Payload `localization` in `payload.config.ts` stays
   * code-bootstrapped from Core bootstrap locales (`en`/`hu`) — admin-added
   * codes need a config change + restart for CMS field locales.
   */
  localeCatalog: Array<{ code: string; label: string }>
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
