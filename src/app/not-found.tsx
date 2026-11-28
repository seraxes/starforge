import React from 'react'
import { NextIntlClientProvider } from 'next-intl'

import { HardcodedNotFoundFallback } from '@/components/HardcodedNotFoundFallback'
import { loadNotFoundIntl } from '@/components/loadNotFoundIntl'
import { SiteNotFoundView } from '@/components/SiteNotFoundView'

export const dynamic = 'force-dynamic'

/**
 * Global 404 — active skin `*-not-found` outline (last resort: hardcoded fallback).
 * Lives at `app/not-found.tsx` so it is outside `[locale]/template` (Assigned Menu shell).
 * Covers public `notFound()`, admin misses, and unmatched URLs.
 */
export default async function GlobalNotFound() {
  const intl = await loadNotFoundIntl('GlobalNotFound')
  if (!intl) return <HardcodedNotFoundFallback />
  return (
    <NextIntlClientProvider locale={intl.locale} messages={intl.messages}>
      <SiteNotFoundView />
    </NextIntlClientProvider>
  )
}
