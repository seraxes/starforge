import React from 'react'
import Link from 'next/link'

import { PublicLayoutBody } from '@/core/modules/PublicLayoutBody'
import { BodyAttributesApplier } from '@/core/page-settings'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  DEFAULT_OFFLINE_MESSAGE,
  DEFAULT_SITE_CHROME_NAME,
  getSiteChrome,
} from '@/core/site-chrome'
import { SkinRootStyles, resolveActiveSkinSystemOutlineId } from '@/core/skin'

type Props = {
  /** Optional overrides when caller already loaded Chrome. */
  siteName?: string
  message?: string
  /** Legacy Chrome override — used only when the outline belongs to the active skin. */
  layoutId?: string
}

/**
 * Public offline screen — active skin tokens + that pack’s `*-offline` outline.
 * Used by `/site-offline` (proxy 503 rewrite) and the locale-layout soft fallback.
 */
export async function SiteOfflineView(props: Props = {}) {
  const [chrome, settings] = await Promise.all([getSiteChrome(), getSiteSettings()])
  const chromeOverride = props.layoutId?.trim() || chrome.offlineLayoutId
  const resolved = await resolveActiveSkinSystemOutlineId('offline', { chromeOverride })

  const siteName =
    props.siteName?.trim() ||
    chrome.siteName?.trim() ||
    settings.siteName?.trim() ||
    DEFAULT_SITE_CHROME_NAME
  const message =
    props.message?.trim() || chrome.offlineMessage?.trim() || DEFAULT_OFFLINE_MESSAGE
  const layoutId = resolved.outlineId
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)

  return (
    <>
      <SkinRootStyles />
      <BodyAttributesApplier
        bodyId=""
        bodyClasses=""
        bodyTagAttributes=""
        sectionsLayout="fullwidth"
        skinId={resolved.skinId}
        outlineId={layoutId}
      />
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
