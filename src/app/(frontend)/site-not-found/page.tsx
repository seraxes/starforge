import React from 'react'

import { SiteNotFoundView } from '@/components/SiteNotFoundView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

/**
 * Error-recovery plumbing only — not a product page.
 * Client `error.tsx` hard-navigates here; view is the active skin’s 404 outline.
 * Locale `not-found.tsx` renders the same view without this URL.
 */
export default async function SiteNotFoundPage() {
  return <SiteNotFoundView />
}
