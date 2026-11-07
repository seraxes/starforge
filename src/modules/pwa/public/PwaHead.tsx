import React from 'react'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { loadPwaThemeColor } from '../build-webmanifest'

/**
 * Public-shell contribution for product:pwa (head).
 * Emits manifest link + theme-color when the module is enabled.
 */
export default async function PwaHead() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pwa)) return null

  const themeColor = await loadPwaThemeColor()

  return (
    <>
      <link rel="manifest" href="/manifest.webmanifest" />
      {themeColor ? <meta name="theme-color" content={themeColor} /> : null}
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
    </>
  )
}
