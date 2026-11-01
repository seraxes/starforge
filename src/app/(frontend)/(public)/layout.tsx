import React from 'react'
import { headers } from 'next/headers'

import { PublicLayoutBody } from '@/core/modules'
import {
  BodyAttributesApplier,
  DocumentBodyChrome,
  DocumentHeadChrome,
  emptyResolvedChrome,
  getResolvedPageChrome,
  pageKeyFromPathname,
} from '@/core/page-settings'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

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
 * Public site shell — Page Settings document chrome + layout document body.
 * Core admin (`/app/admin`) skips this route group.
 * Product module toggles gate chrome emit and layout manager shell.
 */
export default async function PublicSiteLayout(props: { children: React.ReactNode }) {
  const [settings, headerList] = await Promise.all([getSiteSettings(), headers()])
  const pathname = headerList.get('x-sf-pathname') || '/'
  const pageKey = pageKeyFromPathname(pathname)
  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)
  const chrome = pageSettingsOn
    ? await getResolvedPageChrome(pageKey)
    : emptyResolvedChrome(pageKey)

  // Font Awesome product toggle (even when Page Settings chrome is on).
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.fontAwesome) && chrome.fontAwesome) {
    chrome.fontAwesome = { ...chrome.fontAwesome, enabled: false }
  }

  return (
    <>
      {pageSettingsOn ? <DocumentHeadChrome chrome={chrome} /> : null}
      {pageSettingsOn ? (
        <BodyAttributesApplier
          bodyId={chrome.bodyId}
          bodyClasses={chrome.bodyClasses}
          bodyTagAttributes={chrome.bodyTagAttributes}
          sectionsLayout={chrome.sectionsLayout}
        />
      ) : null}
      {pageSettingsOn ? <DocumentBodyChrome chrome={chrome} position="start" /> : null}
      <PublicLayoutBody
        siteName={settings.siteName}
        primaryNav={
          isCatalogModuleEnabled(settings, MODULE_IDS.primaryNav) ? settings.primaryNav : []
        }
        layoutId={chrome.layoutId}
        sectionsLayout={chrome.sectionsLayout}
        layoutManagerEnabled={layoutOn}
      >
        {props.children}
      </PublicLayoutBody>
      {pageSettingsOn ? <DocumentBodyChrome chrome={chrome} position="end" /> : null}
    </>
  )
}
