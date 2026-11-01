import type { CaptchaProvider, SiteChromeDocument } from './types'

export const DEFAULT_SITE_CHROME_NAME = 'Starforge'

export const DEFAULT_ROBOTS_META = 'index, follow'

export const DEFAULT_ROBOTS_TXT = `User-agent: *
Allow: /
`

export const DEFAULT_OFFLINE_MESSAGE =
  'This site is temporarily offline. Please check back soon.'

export const CAPTCHA_PROVIDERS: Array<{ value: CaptchaProvider; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'turnstile', label: 'Cloudflare Turnstile' },
  { value: 'recaptcha', label: 'Google reCAPTCHA (not wired)' },
  { value: 'hcaptcha', label: 'hCaptcha (not wired)' },
]

export const DEFAULT_SITE_CHROME: SiteChromeDocument = {
  version: 1,
  offlineEnabled: false,
  offlineMessage: DEFAULT_OFFLINE_MESSAGE,
  captchaEnabled: false,
  captchaProvider: 'none',
  siteName: DEFAULT_SITE_CHROME_NAME,
  defaultDescription: '',
  defaultOgImage: '',
  robotsMeta: DEFAULT_ROBOTS_META,
  robotsTxt: DEFAULT_ROBOTS_TXT,
  contentRights: '',
  cookieDomain: '',
  cookiePath: '/',
}

const CAPTCHA_SET = new Set<CaptchaProvider>(
  CAPTCHA_PROVIDERS.map((p) => p.value),
)

export function isCaptchaProvider(value: unknown): value is CaptchaProvider {
  return typeof value === 'string' && CAPTCHA_SET.has(value as CaptchaProvider)
}
