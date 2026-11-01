/**
 * Site Chrome document — site-wide policy & metadata (SF-43).
 * Not Page Settings (per-page) and not Modules toggles.
 */

export type CaptchaProvider = 'none' | 'turnstile' | 'recaptcha' | 'hcaptcha'

export type SiteChromeDocument = {
  version: 1
  /** When true, public site shows the offline message (admins still pass). */
  offlineEnabled: boolean
  offlineMessage: string
  /** Default sitewide captcha for forms (provider stub in v1). */
  captchaEnabled: boolean
  captchaProvider: CaptchaProvider
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
