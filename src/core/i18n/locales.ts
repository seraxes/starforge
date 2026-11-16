/**
 * Platform locale catalog (Core i18n port).
 * Public URLs use these codes as `/[locale]/…` prefixes (localePrefix: always).
 * Admin `/admin` stays outside this list. `/cms` redirects there.
 *
 * Bootstrap codes (`en`, `hu`) ship in code. Admins can extend the site catalog
 * under `/admin/localization` (persisted on Site Chrome JSON). Public routing,
 * the switcher, and hreflang pick up new codes immediately.
 */

export const BOOTSTRAP_LOCALES = ['en', 'hu'] as const

/** @deprecated Prefer BOOTSTRAP_LOCALES — kept for existing imports. */
export const LOCALES = BOOTSTRAP_LOCALES

export type BootstrapLocale = (typeof BOOTSTRAP_LOCALES)[number]

/** Public locale code — bootstrap or admin-added (BCP-47-ish). */
export type AppLocale = string

export const DEFAULT_LOCALE: BootstrapLocale = 'en'

export type LocaleCatalogEntry = {
  code: AppLocale
  label: string
}

export const DEFAULT_LOCALE_CATALOG: LocaleCatalogEntry[] = [
  { code: 'en', label: 'English' },
  { code: 'hu', label: 'Magyar' },
]

export const LOCALE_LABELS: Record<BootstrapLocale, string> = {
  en: 'English',
  hu: 'Magyar',
}

/**
 * BCP-47-ish language tag for public URL segments.
 * Accepts `en`, `hu`, `de`, `en-US`, `pt-BR`, `zh-Hans` (max ~16 chars).
 * Rejects path-like or empty values so page slugs are unlikely to collide.
 */
export function isValidLocaleCode(value: unknown): value is AppLocale {
  if (typeof value !== 'string') return false
  const code = value.trim()
  if (!code || code.length > 16) return false
  // language (2–3 letters) + optional -subtags (2–8 alphanumerics)
  return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(code)
}

/**
 * Runtime registry of public locale codes (bootstrap + admin catalog).
 * Path stripping only removes registered prefixes so `/cms` / `/api` / page
 * slugs like `/old` are never mistaken for locales. Proxy + Localization
 * saves refresh this set from Site Chrome JSON.
 */
const registeredLocaleCodes = new Set<string>(BOOTSTRAP_LOCALES)

export function registerPublicLocaleCodes(codes: readonly string[]): void {
  registeredLocaleCodes.clear()
  for (const boot of BOOTSTRAP_LOCALES) {
    registeredLocaleCodes.add(boot)
  }
  for (const raw of codes) {
    const code = normalizeLocaleCode(typeof raw === 'string' ? raw : '')
    if (isValidLocaleCode(code)) registeredLocaleCodes.add(code)
  }
}

export function listRegisteredLocaleCodes(): AppLocale[] {
  return [...registeredLocaleCodes]
}

/** True when the code is in the runtime public locale registry (path-safe). */
export function isRegisteredLocaleCode(value: unknown): value is AppLocale {
  return typeof value === 'string' && registeredLocaleCodes.has(value)
}

/**
 * Path / routing helper — registered public locales only (not every BCP-47 tag).
 * Use `isValidLocaleCode` when validating admin catalog input.
 */
export function isAppLocale(value: unknown): value is AppLocale {
  return isRegisteredLocaleCode(value)
}

export function isBootstrapLocale(value: unknown): value is BootstrapLocale {
  return typeof value === 'string' && (BOOTSTRAP_LOCALES as readonly string[]).includes(value)
}

export function labelForLocale(
  code: string,
  catalog?: readonly LocaleCatalogEntry[] | null,
): string {
  if (catalog) {
    const hit = catalog.find((e) => e.code === code)
    if (hit?.label) return hit.label
  }
  if (isBootstrapLocale(code)) return LOCALE_LABELS[code]
  return code
}

export function normalizeLocaleCode(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  // language subtag lower; region upper (en-us → en-US)
  const parts = trimmed.split('-')
  if (parts.length === 0) return ''
  const language = (parts[0] || '').toLowerCase()
  const rest = parts.slice(1).map((p, i) => {
    if (i === 0 && /^[a-z]{2}$/i.test(p)) return p.toUpperCase()
    if (/^[a-z]{4}$/i.test(p)) return p[0]!.toUpperCase() + p.slice(1).toLowerCase()
    return p
  })
  return [language, ...rest].join('-')
}

/**
 * Map a public route locale onto the bootstrap catalog (`en` / `hu`).
 * Admin-added codes fall back to DEFAULT_LOCALE for callers that only know those two.
 */
export function toPayloadLocale(locale: AppLocale): BootstrapLocale {
  return isBootstrapLocale(locale) ? locale : DEFAULT_LOCALE
}
