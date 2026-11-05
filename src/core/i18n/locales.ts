/**
 * Platform locale catalog (Core i18n port).
 * Public URLs use these codes as `/[locale]/…` prefixes (localePrefix: always).
 * Admin `/admin` and Payload `/cms` stay outside this list.
 */

export const LOCALES = ['en', 'hu'] as const

export type AppLocale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'en'

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  hu: 'Magyar',
}

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
