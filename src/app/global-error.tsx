'use client'

import Link from 'next/link'
import React from 'react'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
  /** Next 16.3+ preferred recovery; falls back to `reset` when absent. */
  retry?: () => void
}

/**
 * Root layout error boundary — replaces `html`/`body`. Never shows stack / digest.
 */
export default function GlobalError({ reset, retry }: Props) {
  const recover = retry ?? reset

  return (
    <html lang="en">
      <body>
        <title>Something went wrong</title>
        <main>
          <article className="cms-page">
            <header className="cms-page-header">
              <h1>Something went wrong</h1>
            </header>
            <p className="lede">An unexpected error occurred.</p>
            <p>
              <button type="button" className="secondary" onClick={() => recover()}>
                Try again
              </button>{' '}
              <Link className="secondary" href="/">
                Back to home
              </Link>
            </p>
          </article>
        </main>
      </body>
    </html>
  )
}
