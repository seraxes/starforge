import React from 'react'
import { NextIntlClientProvider } from 'next-intl'

import { HardcodedNotFoundFallback } from '@/components/HardcodedNotFoundFallback'
import { loadNotFoundIntl } from '@/components/loadNotFoundIntl'
import { SiteNotFoundView } from '@/components/SiteNotFoundView'

export const dynamic = 'force-dynamic'

/**
 * Route-group 404 (same as `app/not-found.tsx`) — outside `[locale]/template`.
 * Keep in sync with the app-root file so Next resolves either boundary the same way.
 */
export default async function FrontendNotFound() {
  const intl = await loadNotFoundIntl('FrontendNotFound')
  if (!intl) return <HardcodedNotFoundFallback />
  return (
    <NextIntlClientProvider locale={intl.locale} messages={intl.messages}>
      <SiteNotFoundView />
    </NextIntlClientProvider>
  )
}
