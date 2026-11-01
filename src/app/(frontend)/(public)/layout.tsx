import React from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { filterNavItemsForViewer, getAccessViewer } from '@/core/acl'
import { userIsAppAdmin } from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import { absoluteAssetUrl, appOrigin } from '@/core/content/metadata'
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
import { getSiteChrome, isOfflineAllowedPath } from '@/core/site-chrome'
import { SiteOffline } from '@/components/SiteOffline'

export async function generateMetadata(): Promise<Metadata> {
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName
  const description = chrome.defaultDescription || undefined
  const ogImage = absoluteAssetUrl(chrome.defaultOgImage)

  return {
    metadataBase: new URL(`${appOrigin()}/`),
    title: {
      default: siteName,
      template: `%s — ${siteName}`,
    },
    description,
    robots: chrome.robotsMeta || undefined,
    openGraph: {
      title: siteName,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName,
      type: 'website',
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: siteName,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

/**
 * Public site shell — Page Settings document chrome + layout document body.
 * Core admin (`/app/admin`) skips this route group.
 * Product module toggles gate chrome emit and layout manager shell.
 * Site Chrome offline: middleware rewrites locked visitors to 503; this layout
 * keeps a soft fallback (and admin banner) if the rewrite did not run.
 */
export default async function PublicSiteLayout(props: { children: React.ReactNode }) {
  const [settings, siteChrome, headerList, viewer, session] = await Promise.all([
    getSiteSettings(),
    getSiteChrome(),
    headers(),
    getAccessViewer(),
    getAppSession(),
  ])
  const pathname = headerList.get('x-sf-pathname') || '/'
  const isAdmin = userIsAppAdmin(session?.user)
  const offlineLocked =
    siteChrome.offlineEnabled && !isAdmin && !isOfflineAllowedPath(pathname)

  if (offlineLocked) {
    // Soft fallback when middleware rewrite did not run (should be rare).
    // Prefer HTTP 503 via middleware → /site-offline.
    return (
      <SiteOffline
        siteName={siteChrome.siteName || settings.siteName}
        message={siteChrome.offlineMessage}
      />
    )
  }

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

  const rawNav = isCatalogModuleEnabled(settings, MODULE_IDS.primaryNav)
    ? settings.primaryNav
    : []
  const primaryNav = filterNavItemsForViewer(rawNav, viewer)
  const brandName = siteChrome.siteName || settings.siteName

  return (
    <>
      {siteChrome.offlineEnabled && isAdmin ? (
        <p className="sf-offline-admin-banner" role="status">
          Site is offline for visitors. You can browse because you are an app admin.{' '}
          <a href="/app/admin/site-chrome">Site Chrome</a>
        </p>
      ) : null}
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
        siteName={brandName}
        primaryNav={primaryNav}
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
