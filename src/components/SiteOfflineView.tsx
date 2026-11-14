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

type Props = {
  /** Optional overrides when caller already loaded Chrome. */
  siteName?: string
  /** Ignored — offline copy lives on the outline (Layouts), not a hardcoded page. */
  message?: string
  /** Site Chrome outline pick — used only when it belongs to the active skin. */
  layoutId?: string
}

/**
 * Public offline screen = active skin’s offline outline (Chrome may pick which one).
 * No hardcoded “Site offline” body — design the page in Layouts on that outline.
 * `/site-offline` is proxy 503 plumbing only; locale layout soft-locks here too.
 * Emits Page Settings chrome for the offline outline (Assets CSS/JS, body attrs, …).
 *
 * All reads bypass published-content `unstable_cache` so a layout/Chrome tag bust
 * (`revalidateTag({ expire: 0 })`) cannot hang the lock page until process restart.
 */
export async function SiteOfflineView(props: Props = {}) {
  const [chrome, settings] = await Promise.all([getSiteChromeForProxy(), getSiteSettingsLive()])
  const chromeOverride = props.layoutId?.trim() || chrome.offlineLayoutId
  const resolved = await resolveActiveSkinSystemOutlineId('offline', { chromeOverride })

  const siteName =
    props.siteName?.trim() ||
    chrome.siteName?.trim() ||
    settings.siteName?.trim() ||
    DEFAULT_SITE_CHROME_NAME
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
    <>
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
    </>
  )
}
