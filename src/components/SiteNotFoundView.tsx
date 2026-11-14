import React from 'react'

import { PublicLayoutBody } from '@/core/modules/PublicLayoutBody'
import {
  BodyAttributesApplier,
  DocumentBodyChrome,
  DocumentHeadChrome,
  emptyResolvedChrome,
  getResolvedPageChromeForOutlineLive,
} from '@/core/page-settings'
import { MODULE_IDS, getSiteSettingsLive, isCatalogModuleEnabled } from '@/core/settings'
import {
  DEFAULT_SITE_CHROME_NAME,
  getSiteChromeForProxy,
} from '@/core/site-chrome'
import { SkinRootStyles, resolveActiveSkinSystemOutlineId } from '@/core/skin'

/**
 * Public 404 screen = active skin’s `*-not-found` outline (the 404 page).
 * No hardcoded body — design copy / CTAs on that outline in Layouts.
 * Locale `not-found.tsx` renders this; `/site-not-found` is error-recovery plumbing.
 * Emits Page Settings chrome for the not-found outline (Assets CSS/JS, body attrs, …).
 * Live/uncached reads — same stall avoidance as offline.
 */
export async function SiteNotFoundView() {
  const [chrome, settings, resolved] = await Promise.all([
    getSiteChromeForProxy(),
    getSiteSettingsLive(),
    resolveActiveSkinSystemOutlineId('not-found'),
  ])

  const siteName = chrome.siteName?.trim() || settings.siteName?.trim() || DEFAULT_SITE_CHROME_NAME
  const layoutId = resolved.outlineId
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)
  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
  const pageChrome = pageSettingsOn
    ? await getResolvedPageChromeForOutlineLive(layoutId)
    : emptyResolvedChrome(null)

  if (!isCatalogModuleEnabled(settings, MODULE_IDS.fontAwesome) && pageChrome.fontAwesome) {
    pageChrome.fontAwesome = { ...pageChrome.fontAwesome, enabled: false }
  }

  return (
    <div className="sf-system-page-breakout" data-sf-system-page="not-found">
      <SkinRootStyles />
      {pageSettingsOn ? <DocumentHeadChrome chrome={pageChrome} /> : null}
      <BodyAttributesApplier
        bodyId={pageSettingsOn ? pageChrome.bodyId : ''}
        bodyClasses={pageSettingsOn ? pageChrome.bodyClasses : ''}
        bodyTagAttributes={pageSettingsOn ? pageChrome.bodyTagAttributes : ''}
        sectionsLayout={pageChrome.sectionsLayout}
        skinId={resolved.skinId}
        outlineId={layoutId}
      />
      {pageSettingsOn ? <DocumentBodyChrome chrome={pageChrome} position="start" /> : null}
      <PublicLayoutBody
        siteName={siteName}
        primaryNav={[]}
        layoutId={layoutId}
        sectionsLayout={pageChrome.sectionsLayout}
        layoutManagerEnabled={layoutOn}
        bypassLayoutCache
      />
      {pageSettingsOn ? <DocumentBodyChrome chrome={pageChrome} position="end" /> : null}
    </div>
  )
}
