import React from 'react'

import { SiteHeader } from '@/components/SiteHeader'
import { ModuleSlot } from '@/core/modules'
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
 * Public site shell — brand + primary nav from Payload site-settings,
 * plus named module positions (`header`, `after-content`, `footer`).
 * Core admin (`/app/admin`) uses its own layout without this chrome.
 */
export default async function PublicSiteLayout(props: { children: React.ReactNode }) {
  const settings = await getSiteSettings()

  return (
    <div className="public-shell">
      <ModuleSlot position="header" className="sf-slot-header" />
      <SiteHeader siteName={settings.siteName} primaryNav={settings.primaryNav} />
      <div className="public-main">{props.children}</div>
      <ModuleSlot position="after-content" className="sf-slot-after-content" />
      <footer className="site-footer">
        <ModuleSlot position="footer" className="sf-slot-footer" />
        <p className="site-footer-meta">
          <span className="site-footer-brand">{settings.siteName}</span>
          <span className="site-footer-sep" aria-hidden="true">
            ·
          </span>
          <span>Built with Starforge</span>
        </p>
      </footer>
    </div>
  )
}
