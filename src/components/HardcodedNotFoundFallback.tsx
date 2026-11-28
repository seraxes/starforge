import React from 'react'
import Link from 'next/link'

/** Marker on the last-resort 404 shell (tests + diagnostics). */
export const HARDCODED_NOT_FOUND_PAGE = 'not-found-hardcoded' as const

/**
 * Last-resort 404 when the active skin’s `*-not-found` outline cannot render
 * (DB / seed / layout failure). Prefer {@link SiteNotFoundView} everywhere else.
 */
export function HardcodedNotFoundFallback() {
  return (
    <div className="sf-system-page-breakout" data-sf-system-page={HARDCODED_NOT_FOUND_PAGE}>
      <article className="cms-page">
        <header className="cms-page-header">
          <h1>Page not found</h1>
        </header>
        <p className="lede">That page is not available.</p>
        <p>
          <Link className="secondary" href="/">
            Back to home
          </Link>
        </p>
      </article>
    </div>
  )
}
