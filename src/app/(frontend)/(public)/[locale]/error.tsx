'use client'

import Link from 'next/link'
import React, { useEffect } from 'react'

/** Hardcoded system recovery URL — keep in sync with `SITE_NOT_FOUND_PATH`. */
const SITE_NOT_FOUND_PATH = '/site-not-found'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Locale error boundary — never shows stack / framework messages.
 * Recovers on the hardcoded `/site-not-found` system page (active skin 404 outline).
 */
export default function PublicLocaleError({ reset }: Props) {
  useEffect(() => {
    window.location.replace(SITE_NOT_FOUND_PATH)
  }, [])

  return (
    <article className="cms-page">
      <header className="cms-page-header">
        <h1>Something went wrong</h1>
      </header>
      <p className="lede">Taking you to a safe page…</p>
      <p>
        <button type="button" className="secondary" onClick={() => reset()}>
          Try again
        </button>{' '}
        <Link className="secondary" href="/">
          Back to home
        </Link>
      </p>
    </article>
  )
}
