import React from 'react'

import { SiteOfflineView } from '@/components/SiteOfflineView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site offline',
  robots: { index: false, follow: false },
}

/**
 * Internal rewrite target for Site Chrome offline mode.
 * Proxy rewrites locked visitors here with HTTP 503 (+ Retry-After).
 * Renders the active skin + configured offline outline.
 */
export default async function SiteOfflinePage() {
  return <SiteOfflineView />
}
