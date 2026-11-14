import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'

import { SiteOfflineView } from '@/components/SiteOfflineView'
import { getPublicDefaultLocale } from '@/core/i18n/enabled'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site offline',
  robots: { index: false, follow: false },
}

/**
 * Proxy 503 plumbing only — not a product page.
 * Locked visitors rewrite here; view is the active skin’s Offline outline.
 *
 * Outside `[locale]` — provide next-intl here so outline particles
 * (Logo / Menu / Site Header) can use locale-aware Link.
 */
export default async function SiteOfflinePage() {
  const locale = await getPublicDefaultLocale()
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SiteOfflineView />
    </NextIntlClientProvider>
  )
}
