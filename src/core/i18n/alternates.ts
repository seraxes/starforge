import { DEFAULT_LOCALE, LOCALES, isAppLocale, type AppLocale } from './locales'
import { withLocalePrefix } from './path'

function defaultOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

/**
 * Build Next.js `alternates.languages` / hreflang map for a bare public path.
 * `locales` should be Localization settings `localesEnabled` (fallback: catalog).
 */
export function buildLanguageAlternates(
  barePath: string,
  locales: readonly string[] = LOCALES,
  origin: string = defaultOrigin(),
): Record<string, string> {
  const enabled = locales.filter(isAppLocale)
  const list: AppLocale[] = enabled.length > 0 ? enabled : [...LOCALES]
  const base = origin.replace(/\/$/, '')
  const languages: Record<string, string> = {}
  for (const locale of list) {
    languages[locale] = `${base}${withLocalePrefix(barePath, locale)}`
  }
  // x-default → platform default when enabled, else first enabled locale.
  const xDefault = list.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : list[0]!
  languages['x-default'] = `${base}${withLocalePrefix(barePath, xDefault)}`
  return languages
}

/** Metadata fragment for public pages — language alternates only. */
export function languageAlternateMetadata(
  barePath: string,
  locales: readonly string[],
  origin?: string,
): { alternates: { languages: Record<string, string> } } {
  return {
    alternates: {
      languages: buildLanguageAlternates(barePath, locales, origin),
    },
  }
}
