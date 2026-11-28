import 'server-only'

import { getMessages, setRequestLocale } from 'next-intl/server'

import { DEFAULT_LOCALE, type AppLocale } from '@/core/i18n'
import { getPublicDefaultLocale } from '@/core/i18n/enabled'

export type NotFoundIntlBundle = {
  locale: AppLocale
  messages: Awaited<ReturnType<typeof getMessages>>
}

/**
 * Bootstrap next-intl for root / plumbing 404 shells (outside `[locale]`).
 * Returns null so callers can paint {@link HardcodedNotFoundFallback}.
 */
export async function loadNotFoundIntl(logLabel: string): Promise<NotFoundIntlBundle | null> {
  try {
    const locale = await getPublicDefaultLocale()
    setRequestLocale(locale)
    const messages = await getMessages()
    return { locale, messages }
  } catch (err) {
    console.error(`[${logLabel}] failed before skin 404; using hardcoded fallback`, err)
    try {
      setRequestLocale(DEFAULT_LOCALE)
    } catch {
      // ignore
    }
    return null
  }
}
