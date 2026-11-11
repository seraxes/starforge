import React from 'react'
import Link from 'next/link'

import { PublicLayoutBody } from '@/core/modules/PublicLayoutBody'
import { BodyAttributesApplier } from '@/core/page-settings'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  DEFAULT_SITE_CHROME_NAME,
  getSiteChrome,
} from '@/core/site-chrome'
import { SkinRootStyles, resolveActiveSkinSystemOutlineId } from '@/core/skin'

/**
 * Public 404 screen — active skin tokens + that pack’s `*-not-found` outline.
 * Used by `/site-not-found` and locale `not-found.tsx`.
 * Breaks out of the locale template shell so the 404 outline is the only chrome.
 */
export async function SiteNotFoundView() {
  const [chrome, settings, resolved] = await Promise.all([
    getSiteChrome(),
    getSiteSettings(),
    resolveActiveSkinSystemOutlineId('not-found'),
  ])

  const siteName = chrome.siteName?.trim() || settings.siteName?.trim() || DEFAULT_SITE_CHROME_NAME
  const layoutId = resolved.outlineId
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)

  return (
    <div className="sf-system-page-breakout" data-sf-system-page="not-found">
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
        <div className="sf-not-found" data-sf-not-found="">
          <div className="sf-not-found-inner">
            <h1>Page not found</h1>
            <p className="lede">This page is missing or no longer published.</p>
            <p className="sf-not-found-home">
              <Link href="/">Back to home</Link>
            </p>
          </div>
        </div>
      </PublicLayoutBody>
    </div>
  )
}
