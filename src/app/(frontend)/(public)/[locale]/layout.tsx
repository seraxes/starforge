import React from 'react'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'

import { SiteOfflineView } from '@/components/SiteOfflineView'
import { userIsAppAdmin } from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import { absoluteAssetUrl, appOrigin } from '@/core/content/metadata'
import { getEnabledPublicLocales } from '@/core/i18n/enabled'
import { isValidLocaleCode, routing } from '@/core/i18n'
import { publicPathnameFromHeaders } from '@/core/page-settings'
import { getSiteSettings } from '@/core/settings'
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
 * Public locale providers + offline gate. Page chrome / outline shell lives in
 * `template.tsx` so it remounts on every navigation (Assigned Menu outline wins).
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

  const [settings, siteChrome, headerList, session, messages, t] = await Promise.all([
    getSiteSettings(),
    getSiteChrome(),
    headers(),
    getAppSession(),
    getMessages(),
    getTranslations('Layout'),
  ])
  const pathname = publicPathnameFromHeaders(headerList, locale)
  const isAdmin = userIsAppAdmin(session?.user)
  const offlineLocked =
    siteChrome.offlineEnabled && !isAdmin && !isOfflineAllowedPath(pathname)

  if (offlineLocked) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SiteOfflineView
          siteName={siteChrome.siteName || settings.siteName}
          message={siteChrome.offlineMessage}
          layoutId={siteChrome.offlineLayoutId}
        />
      </NextIntlClientProvider>
    )
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {siteChrome.offlineEnabled && isAdmin ? (
        <p className="sf-offline-admin-banner" role="status">
          {t('offlineAdminBanner')}{' '}
          <Link href="/admin/site-chrome">{t('offlineAdminChromeLink')}</Link>
        </p>
      ) : null}
      {children}
    </NextIntlClientProvider>
  )
}
