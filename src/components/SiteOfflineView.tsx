import React from 'react'
import Link from 'next/link'

import { PublicLayoutBody } from '@/core/modules/PublicLayoutBody'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  DEFAULT_OFFLINE_LAYOUT_ID,
  DEFAULT_OFFLINE_MESSAGE,
  DEFAULT_SITE_CHROME_NAME,
  getSiteChrome,
} from '@/core/site-chrome'
import { SkinRootStyles, ensureSkinOutlineSeeds, getActiveSkin } from '@/core/skin'

type Props = {
  /** Optional overrides when caller already loaded Chrome. */
  siteName?: string
  message?: string
  layoutId?: string
}

/**
 * Public offline screen — active skin tokens + Site Chrome offline outline.
 * Used by `/site-offline` (proxy 503 rewrite) and the locale-layout soft fallback.
 */
export async function SiteOfflineView(props: Props = {}) {
  const [chrome, settings, activeSkin] = await Promise.all([
    getSiteChrome(),
    getSiteSettings(),
    getActiveSkin(),
  ])
  await ensureSkinOutlineSeeds(activeSkin.id)

  const siteName =
    props.siteName?.trim() ||
    chrome.siteName?.trim() ||
    settings.siteName?.trim() ||
    DEFAULT_SITE_CHROME_NAME
  const message =
    props.message?.trim() || chrome.offlineMessage?.trim() || DEFAULT_OFFLINE_MESSAGE
  const layoutId =
    props.layoutId?.trim() ||
    chrome.offlineLayoutId?.trim() ||
    DEFAULT_OFFLINE_LAYOUT_ID
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)

  return (
    <>
      <SkinRootStyles />
      <PublicLayoutBody
        siteName={siteName}
        primaryNav={[]}
        layoutId={layoutId}
        layoutManagerEnabled={layoutOn}
      >
        <div className="sf-offline" data-sf-offline="">
          <div className="sf-offline-inner">
            <h1>Site offline</h1>
            <p className="lede">{message}</p>
            <p className="sf-offline-login">
              <Link href="/login">Admin sign in</Link>
            </p>
          </div>
        </div>
      </PublicLayoutBody>
    </>
  )
}
