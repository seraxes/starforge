import React from 'react'
import { headers } from 'next/headers'

import { PublicLayoutBody } from '@/core/modules'
import {
  BodyAttributesApplier,
  DocumentBodyChrome,
  DocumentHeadChrome,
  getResolvedPageChrome,
  pageKeyFromPathname,
} from '@/core/page-settings'
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
 * Public site shell — Page Settings document chrome + layout document body.
 * Core admin (`/app/admin`) skips this route group.
 */
export default async function PublicSiteLayout(props: { children: React.ReactNode }) {
  const [settings, headerList] = await Promise.all([getSiteSettings(), headers()])
  const pathname = headerList.get('x-sf-pathname') || '/'
  const pageKey = pageKeyFromPathname(pathname)
  // Auth routes still get site-global chrome (FA, assets) via pageKey null.
  const chrome = await getResolvedPageChrome(pageKey)

  return (
    <>
      <DocumentHeadChrome chrome={chrome} />
      <BodyAttributesApplier
        bodyId={chrome.bodyId}
        bodyClasses={chrome.bodyClasses}
        bodyTagAttributes={chrome.bodyTagAttributes}
        sectionsLayout={chrome.sectionsLayout}
      />
      <DocumentBodyChrome chrome={chrome} position="start" />
      <PublicLayoutBody
        siteName={settings.siteName}
        primaryNav={settings.primaryNav}
        layoutId={chrome.layoutId}
        sectionsLayout={chrome.sectionsLayout}
      >
        {props.children}
      </PublicLayoutBody>
      <DocumentBodyChrome chrome={chrome} position="end" />
    </>
  )
}
