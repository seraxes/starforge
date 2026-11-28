import React from 'react'
import { NextIntlClientProvider } from 'next-intl'

import { HardcodedNotFoundFallback } from '@/components/HardcodedNotFoundFallback'
import { loadNotFoundIntl } from '@/components/loadNotFoundIntl'
import { SiteNotFoundView } from '@/components/SiteNotFoundView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

/**
 * Error-recovery plumbing only — not a product page.
 * Client `error.tsx` hard-navigates here; view is the active skin’s 404 outline.
 * Locale + root `not-found.tsx` render the same view without this URL.
 */
export default async function SiteNotFoundPage() {
  const intl = await loadNotFoundIntl('SiteNotFoundPage')
  if (!intl) return <HardcodedNotFoundFallback />
  return (
    <NextIntlClientProvider locale={intl.locale} messages={intl.messages}>
      <SiteNotFoundView />
    </NextIntlClientProvider>
  )
}
