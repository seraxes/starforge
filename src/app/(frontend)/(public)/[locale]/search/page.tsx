import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import {
  normalizeSearchQuery,
  searchPublishedPages,
} from '@/core/content/search'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { SearchForm, SearchResults } from '@/modules/search'

type Args = {
  searchParams: Promise<{ q?: string | string[] }>
}

export async function generateMetadata({ searchParams }: Args): Promise<Metadata> {
  const [settings, chrome, params] = await Promise.all([
    getSiteSettings(),
    getSiteChrome(),
    searchParams,
  ])
  const siteName = chrome.siteName || settings.siteName
  const q = normalizeSearchQuery(
    Array.isArray(params.q) ? params.q[0] : params.q,
  )

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
export default async function PublicSearchPage({ searchParams }: Args) {
  const [settings, params] = await Promise.all([getSiteSettings(), searchParams])

  if (!isCatalogModuleEnabled(settings, MODULE_IDS.search)) {
    notFound()
  }

  const query = normalizeSearchQuery(
    Array.isArray(params.q) ? params.q[0] : params.q,
  )
  const result = await searchPublishedPages(query)

  return (
    <article className="cms-page sf-search-page">
      <header className="cms-page-header">
        <h1>Search</h1>
      </header>
      <SearchForm query={result.query} />
      <SearchResults
        query={result.query}
        hits={result.hits}
        totalDocs={result.totalDocs}
      />
    </article>
  )
}
