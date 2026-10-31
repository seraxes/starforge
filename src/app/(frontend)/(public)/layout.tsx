import React from 'react'

import { PublicLayoutBody } from '@/core/modules'
import { getSiteSettings } from '@/core/settings'

export async function generateMetadata() {
  const settings = await getSiteSettings()
  return {
    title: {
      default: settings.siteName,
      template: `%s — ${settings.siteName}`,
    },
  }
}

/**
 * Public site shell — sections/rows/slots from the layout document
 * (site-header + page-content particles). Core admin skips this chrome.
 */
export default async function PublicSiteLayout(props: { children: React.ReactNode }) {
  const settings = await getSiteSettings()

  return (
    <PublicLayoutBody siteName={settings.siteName} primaryNav={settings.primaryNav}>
      {props.children}
    </PublicLayoutBody>
  )
}
