import Link from 'next/link'
import React from 'react'

import type { PublishedSearchHit } from '@/core/content/search'

export type SearchResultsProps = {
  query: string
  hits: PublishedSearchHit[]
  totalDocs: number
}

/**
 * Public search result list for published pages.
 */
export function SearchResults({ query, hits, totalDocs }: SearchResultsProps) {
  if (!query) {
    return (
      <p className="sf-search-empty lede">
        Enter a search term to find published pages by title, slug, or meta.
      </p>
    )
  }

  if (hits.length === 0) {
    return (
      <p className="sf-search-empty lede" role="status">
        No published pages matched <strong>{query}</strong>.
      </p>
    )
  }

  const countLabel =
    totalDocs > hits.length
      ? `Showing ${hits.length} of ${totalDocs}`
      : `${hits.length} result${hits.length === 1 ? '' : 's'}`

  return (
    <div className="sf-search-results">
      <p className="sf-search-results-meta" role="status">
        {countLabel} for <strong>{query}</strong>
      </p>
      <ul className="sf-search-results-list">
        {hits.map((hit) => (
          <li key={hit.id} className="sf-search-results-item">
            <Link className="sf-search-results-link" href={hit.path}>
              {hit.title}
            </Link>
            <p className="sf-search-results-path">
              <code>{hit.path}</code>
            </p>
            {hit.excerpt ? <p className="sf-search-results-excerpt">{hit.excerpt}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
