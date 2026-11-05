import { DEFAULT_LOCALE, LOCALES } from '@/core/i18n/locales'

import type { LocalizationSettings } from './types'

export const DEFAULT_LOCALIZATION: LocalizationSettings = {
  localesEnabled: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localeFallback: true,
}
