import { getRequestConfig } from 'next-intl/server'

import { DEFAULT_LOCALE, isValidLocaleCode } from './locales'

async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  try {
    return (await import(`./messages/${locale}.json`)).default
  } catch {
    // Admin-added locales reuse English UI chrome until a message pack exists.
    return (await import(`./messages/${DEFAULT_LOCALE}.json`)).default
  }
}

/**
 * next-intl request config — message catalogs live under Core i18n.
 * Plugin path: `./src/core/i18n/request.ts` (see next.config.ts).
 * Unknown / admin-added locales fall back to the default message pack.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale =
    typeof requested === 'string' && isValidLocaleCode(requested)
      ? requested
      : DEFAULT_LOCALE

  return {
    locale,
    messages: await loadMessages(locale),
  }
})
