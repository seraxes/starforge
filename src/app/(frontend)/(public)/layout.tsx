import React from 'react'

import { SiteHeader } from '@/components/SiteHeader'
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
 * Public site shell — brand + primary nav from Payload site-settings
 * (page relationships / custom URLs resolved in core).
 * Core admin (`/app/admin`) uses its own layout without this chrome.
 */
export default async function PublicSiteLayout(props: { children: React.ReactNode }) {
  const settings = await getSiteSettings()

  return (
    <>
      <SiteHeader siteName={settings.siteName} primaryNav={settings.primaryNav} />
      {props.children}
    </>
  )
}
