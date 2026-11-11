import React from 'react'

import { SiteNotFoundView } from '@/components/SiteNotFoundView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

/**
 * Hardcoded system URL for the active skin’s 404 outline.
 * Locale `not-found.tsx` and `error.tsx` recovery land here / reuse the same view.
 */
export default async function SiteNotFoundPage() {
  return <SiteNotFoundView />
}
