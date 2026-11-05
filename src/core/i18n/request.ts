import { getRequestConfig } from 'next-intl/server'

import { loadMergedMessages } from './load-messages'
import { DEFAULT_LOCALE, isValidLocaleCode } from './locales'

/**
 * next-intl request config — Core catalogs + enabled module namespaces (P3).
 * Plugin path: `./src/core/i18n/request.ts` (see next.config.ts).
 * Unknown / admin-added locales fall back to the default message pack for Core;
 * modules fall back per-loader inside `loadMergedMessages`.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale =
    typeof requested === 'string' && isValidLocaleCode(requested)
      ? requested
      : DEFAULT_LOCALE

  return {
    locale,
    messages: await loadMergedMessages(locale),
  }
})
