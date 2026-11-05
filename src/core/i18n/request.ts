import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { DEFAULT_LOCALE } from './locales'
import { routing } from './routing'

/**
 * next-intl request config — message catalogs live under Core i18n.
 * Plugin path: `./src/core/i18n/request.ts` (see next.config.ts).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
