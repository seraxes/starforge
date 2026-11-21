import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'

import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

type Args = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: 'Friend requests',
    description: `Friend requests on ${siteName}.`,
  }
}

/**
 * Friend requests — `/feed/requests`.
 * Slice 7 hosts request management on People; this route redirects there.
 */
export default async function SocialRequestsStubPage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  redirect(withLocalePrefix('/feed/people', locale))
}
