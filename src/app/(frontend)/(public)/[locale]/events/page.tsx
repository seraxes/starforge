import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { EventsHub } from '@/modules/events/public/EventsHub'

type Args = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string | string[]; thumbs?: string | string[] }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: 'Events',
    description: `Upcoming events on ${siteName}.`,
  }
}

/**
 * Public events hub — four clean views (upcoming / calendar / map / list).
 * Featured carousel + mini calendar live as layout particles.
 */
export default async function PublicEventsPage({ params, searchParams }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) {
    notFound()
  }
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    notFound()
  }

  const { view, thumbs } = await searchParams
  const viewer = await getAccessViewer()

  return (
    <article className="cms-page sf-events-page">
      <header className="cms-page-header">
        <h1>Events</h1>
      </header>
      <EventsHub
        locale={locale}
        viewer={viewer}
        viewRaw={view}
        thumbsRaw={thumbs}
      />
    </article>
  )
}
