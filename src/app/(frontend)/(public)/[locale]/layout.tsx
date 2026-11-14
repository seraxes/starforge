import React from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'

import { SiteOfflineView } from '@/components/SiteOfflineView'
import { absoluteAssetUrl, appOrigin } from '@/core/content/metadata'
import { getEnabledPublicLocales } from '@/core/i18n/enabled'
import { isValidLocaleCode, routing } from '@/core/i18n'
import { publicPathnameFromHeaders } from '@/core/page-settings'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome, getSiteChromeForProxy, isOfflineAllowedPath } from '@/core/site-chrome'

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
 * Public locale providers + offline gate. Page chrome / outline shell lives in
 * `template.tsx` so it remounts on every navigation (Assigned Menu outline wins).
 * Offline locks everyone the same (no admin bypass); `/admin` stays exempt in proxy.
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

  // Decide offline from live Chrome only — never await published-content cache first.
  const [siteChrome, headerList, messages] = await Promise.all([
    getSiteChromeForProxy(),
    headers(),
    getMessages(),
  ])
  const pathname = publicPathnameFromHeaders(headerList, locale)
  const offlineLocked = siteChrome.offlineEnabled && !isOfflineAllowedPath(pathname)

  if (offlineLocked) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SiteOfflineView
          siteName={siteChrome.siteName}
          layoutId={siteChrome.offlineLayoutId}
        />
      </NextIntlClientProvider>
    )
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
