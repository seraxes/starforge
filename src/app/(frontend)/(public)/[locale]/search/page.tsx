import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { requireContentLocale } from '@/core/content/pages'
import {
  normalizeSearchQuery,
  searchPublishedPages,
} from '@/core/content/search'
import { routing } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { SearchForm, SearchResults } from '@/modules/search'

type Args = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string | string[] }>
}

export async function generateMetadata({ params, searchParams }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome, search] = await Promise.all([
    getSiteSettings(),
    getSiteChrome(),
    searchParams,
  ])
  const siteName = chrome.siteName || settings.siteName
  const q = normalizeSearchQuery(
    Array.isArray(search.q) ? search.q[0] : search.q,
  )

  if (!hasLocale(routing.locales, localeParam)) {
    return { title: `Not found — ${siteName}` }
  }

  if (!isCatalogModuleEnabled(settings, MODULE_IDS.search)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: q ? `Search: ${q}` : 'Search',
    description: q
      ? `Search results for “${q}” on ${siteName}.`
      : `Search published pages on ${siteName}.`,
    robots: 'noindex,follow',
  }
}

/**
 * Public search (SF-132 / product:search).
 * Queries published Payload pages only; gated by Site Settings → Modules.
 */
export default async function PublicSearchPage({ params, searchParams }: Args) {
  const { locale: localeParam } = await params
  if (!hasLocale(routing.locales, localeParam)) {
    notFound()
  }
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, search] = await Promise.all([getSiteSettings(), searchParams])

  if (!isCatalogModuleEnabled(settings, MODULE_IDS.search)) {
    notFound()
  }

  const query = normalizeSearchQuery(
    Array.isArray(search.q) ? search.q[0] : search.q,
  )
  const result = await searchPublishedPages(query, locale)

  return (
    <article className="cms-page sf-search-page">
      <header className="cms-page-header">
        <h1>Search</h1>
      </header>
      <SearchForm query={result.query} action={withLocalePrefix('/search', locale)} />
      <SearchResults
        query={result.query}
        hits={result.hits}
        totalDocs={result.totalDocs}
      />
    </article>
  )
}
