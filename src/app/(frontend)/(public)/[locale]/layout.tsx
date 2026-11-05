import React from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'

import { SiteOffline } from '@/components/SiteOffline'
import { filterNavItemsForViewer, getAccessViewer } from '@/core/acl'
import { userIsAppAdmin } from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import { absoluteAssetUrl, appOrigin } from '@/core/content/metadata'
import { getEnabledPublicLocales } from '@/core/i18n/enabled'
import { isValidLocaleCode, routing } from '@/core/i18n'
import { PublicLayoutBody, PublicShellSlots } from '@/core/modules'
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

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

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
 * Public site shell under `/[locale]/…` — Page Settings chrome + layout body.
 * Core admin (`/admin`) and Payload (`/cms`) stay outside this segment.
 * Site Chrome offline: proxy rewrites locked visitors to 503; this layout
 * keeps a soft fallback (and admin banner) if the rewrite did not run.
 */
export default async function PublicLocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!isValidLocaleCode(locale)) {
    notFound()
  }
  const enabled = await getEnabledPublicLocales()
  if (!enabled.includes(locale)) {
    notFound()
  }
  setRequestLocale(locale)

  const [settings, siteChrome, headerList, viewer, session, messages, t] =
    await Promise.all([
      getSiteSettings(),
      getSiteChrome(),
      headers(),
      getAccessViewer(),
      getAppSession(),
      getMessages(),
      getTranslations('Layout'),
    ])
  const pathname = headerList.get('x-sf-pathname') || `/${locale}`
  const isAdmin = userIsAppAdmin(session?.user)
  const offlineLocked =
    siteChrome.offlineEnabled && !isAdmin && !isOfflineAllowedPath(pathname)

  if (offlineLocked) {
    // Soft fallback when proxy rewrite did not run (should be rare).
    // Prefer HTTP 503 via proxy → /site-offline.
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SiteOffline
          siteName={siteChrome.siteName || settings.siteName}
          message={siteChrome.offlineMessage}
        />
      </NextIntlClientProvider>
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
    <NextIntlClientProvider locale={locale} messages={messages}>
      {siteChrome.offlineEnabled && isAdmin ? (
        <p className="sf-offline-admin-banner" role="status">
          {t('offlineAdminBanner')}{' '}
          <Link href="/admin/site-chrome">{t('offlineAdminChromeLink')}</Link>
        </p>
      ) : null}
      {pageSettingsOn ? <DocumentHeadChrome chrome={chrome} /> : null}
      <PublicShellSlots slot="head" />
      {pageSettingsOn ? (
        <BodyAttributesApplier
          bodyId={chrome.bodyId}
          bodyClasses={chrome.bodyClasses}
          bodyTagAttributes={chrome.bodyTagAttributes}
          sectionsLayout={chrome.sectionsLayout}
        />
      ) : null}
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
    </NextIntlClientProvider>
  )
}
