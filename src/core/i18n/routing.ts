import { defineRouting } from 'next-intl/routing'

import { DEFAULT_LOCALE, LOCALES } from './locales'

/**
 * next-intl routing — public App Router only.
 * Prefer localePrefix `always` for clear cache keys / sitemap / redirects (P0).
 */
export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
})
