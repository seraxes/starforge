import React from 'react'
import { getLocale } from 'next-intl/server'
import { headers } from 'next/headers'

import { filterNavItemsForViewer, getAccessViewer } from '@/core/acl'
import { PublicLayoutBody, PublicShellSlots } from '@/core/modules'
import {
  BodyAttributesApplier,
  DocumentBodyChrome,
  DocumentHeadChrome,
  emptyResolvedChrome,
  getResolvedPageChrome,
  publicPathnameFromHeaders,
} from '@/core/page-settings'
import { pageKeyForPublicPath } from '@/core/nav/root'
import { PublicShellSync } from '@/core/page-settings/public-shell-sync'
import { paintedPublicShellKey } from '@/core/page-settings/shell-key.server'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getActiveSkin } from '@/core/skin/resolve-active'
import { SkinRootStyles } from '@/core/skin/SkinRootStyles'
import { getSiteChrome } from '@/core/site-chrome'

type Props = {
  children: React.ReactNode
}

/**
 * Public surround for the current path (outline, sections width, head/body chrome).
 * Templates do not receive `params` — locale comes from next-intl (set in layout).
 * Next.js reuses this segment on client navigations when `[locale]` does not
 * change; `PublicShellSync` refetches it when the next URL needs a different shell.
 */
export default async function PublicLocaleTemplate({ children }: Props) {
  const locale = await getLocale()
  const [settings, siteChrome, headerList, viewer] = await Promise.all([
    getSiteSettings(),
    getSiteChrome(),
    headers(),
    getAccessViewer(),
  ])

  // Prefer bare path (set by proxy) so pageKey does not depend on locale prefix.
  const bare = (headerList.get('x-sf-pathname-bare') || '').trim()
  const pathname = bare
    ? bare.startsWith('/')
      ? bare
      : `/${bare}`
    : publicPathnameFromHeaders(headerList, locale)
  const pageKey = await pageKeyForPublicPath(pathname)
  const clientPath = publicPathnameFromHeaders(headerList, locale)
  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)
  const [chrome, skin] = await Promise.all([
    pageSettingsOn ? getResolvedPageChrome(pageKey) : Promise.resolve(emptyResolvedChrome(pageKey)),
    getActiveSkin(),
  ])

  if (!isCatalogModuleEnabled(settings, MODULE_IDS.fontAwesome) && chrome.fontAwesome) {
    chrome.fontAwesome = { ...chrome.fontAwesome, enabled: false }
  }

  const rawNav = isCatalogModuleEnabled(settings, MODULE_IDS.primaryNav)
    ? settings.primaryNav
    : []
  const primaryNav = filterNavItemsForViewer(rawNav, viewer)
  const brandName = siteChrome.siteName || settings.siteName

  const shellKey = await paintedPublicShellKey({
    layoutId: chrome.layoutId,
    sectionsLayout: chrome.sectionsLayout,
    outlineFallbackId: skin.preferredDefaultOutlineId || skin.id,
    layoutManagerEnabled: layoutOn,
  })

  return (
    <>
      <PublicShellSync renderedPath={clientPath} shellKey={shellKey} />
      <SkinRootStyles />
      {pageSettingsOn ? <DocumentHeadChrome chrome={chrome} /> : null}
      <PublicShellSlots slot="head" />
      <BodyAttributesApplier
        bodyId={pageSettingsOn ? chrome.bodyId : ''}
        bodyClasses={pageSettingsOn ? chrome.bodyClasses : ''}
        bodyTagAttributes={pageSettingsOn ? chrome.bodyTagAttributes : ''}
        sectionsLayout={chrome.sectionsLayout}
        skinId={skin.id}
        outlineId={shellKey.outlineId}
      />
      {pageSettingsOn ? <DocumentBodyChrome chrome={chrome} position="start" /> : null}
      <PublicShellSlots slot="bodyStart" />
      <PublicLayoutBody
        siteName={brandName}
        primaryNav={primaryNav}
        layoutId={chrome.layoutId}
        sectionsLayout={chrome.sectionsLayout}
        layoutManagerEnabled={layoutOn}
      >
        {children}
      </PublicLayoutBody>
      {pageSettingsOn ? <DocumentBodyChrome chrome={chrome} position="end" /> : null}
      <PublicShellSlots slot="bodyEnd" />
    </>
  )
}
