import { DEFAULT_LOCALE, DEFAULT_LOCALE_CATALOG, LOCALES } from '@/core/i18n/locales'

import type { LocalizationSettings } from './types'

export const DEFAULT_LOCALIZATION: LocalizationSettings = {
  localeCatalog: DEFAULT_LOCALE_CATALOG.map((e) => ({ ...e })),
  localesEnabled: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localeFallback: true,
}
