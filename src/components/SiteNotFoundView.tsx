import React from 'react'

import { HardcodedNotFoundFallback } from '@/components/HardcodedNotFoundFallback'
import { PublicLayoutBody } from '@/core/modules/PublicLayoutBody'
import {
  BodyAttributesApplier,
  DocumentBodyChrome,
  DocumentHeadChrome,
  emptyResolvedChrome,
  getResolvedPageChromeForOutlineLive,
  type ResolvedPageChrome,
} from '@/core/page-settings'
import { MODULE_IDS, getSiteSettingsLive, isCatalogModuleEnabled } from '@/core/settings'
import {
  DEFAULT_SITE_CHROME_NAME,
  getSiteChromeForProxy,
} from '@/core/site-chrome'
import { SkinRootStyles, resolveActiveSkinSystemOutlineId } from '@/core/skin'

type SkinNotFoundPaint = {
  siteName: string
  layoutId: string
  skinId: string
  layoutOn: boolean
  pageSettingsOn: boolean
  pageChrome: ResolvedPageChrome
}

/**
 * Public 404 screen = active skin’s `*-not-found` outline (the 404 page).
 * No hardcoded body on the happy path — design copy / CTAs on that outline in Layouts.
 * Locale + root `not-found.tsx` render this; `/site-not-found` is error-recovery plumbing.
 * On resolve failure → {@link HardcodedNotFoundFallback} (last resort only).
 */
export async function SiteNotFoundView() {
  const paint = await loadSkinNotFoundPaint()
  if (!paint) return <HardcodedNotFoundFallback />

  const { siteName, layoutId, skinId, layoutOn, pageSettingsOn, pageChrome } = paint
  return (
    <div className="sf-system-page-breakout" data-sf-system-page="not-found">
      <SkinRootStyles />
      {pageSettingsOn ? <DocumentHeadChrome chrome={pageChrome} /> : null}
      <BodyAttributesApplier
        bodyId={pageSettingsOn ? pageChrome.bodyId : ''}
        bodyClasses={pageSettingsOn ? pageChrome.bodyClasses : ''}
        bodyTagAttributes={pageSettingsOn ? pageChrome.bodyTagAttributes : ''}
        sectionsLayout={pageChrome.sectionsLayout}
        skinId={skinId}
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

async function loadSkinNotFoundPaint(): Promise<SkinNotFoundPaint | null> {
  try {
    const [chrome, settings, resolved] = await Promise.all([
      getSiteChromeForProxy(),
      getSiteSettingsLive(),
      resolveActiveSkinSystemOutlineId('not-found'),
    ])

    const siteName =
      chrome.siteName?.trim() || settings.siteName?.trim() || DEFAULT_SITE_CHROME_NAME
    const layoutId = resolved.outlineId
    const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)
    const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
    const pageChrome = pageSettingsOn
      ? await getResolvedPageChromeForOutlineLive(layoutId)
      : emptyResolvedChrome(null)

    if (!isCatalogModuleEnabled(settings, MODULE_IDS.fontAwesome) && pageChrome.fontAwesome) {
      pageChrome.fontAwesome = { ...pageChrome.fontAwesome, enabled: false }
    }

    return {
      siteName,
      layoutId,
      skinId: resolved.skinId,
      layoutOn,
      pageSettingsOn,
      pageChrome,
    }
  } catch (err) {
    console.error('[SiteNotFoundView] skin 404 outline failed; using hardcoded fallback', err)
    return null
  }
}
