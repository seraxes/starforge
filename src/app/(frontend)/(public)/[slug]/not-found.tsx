import Link from 'next/link'
import React from 'react'

export default function CmsPageNotFound() {
  return (
    <div className="cms-not-found">
      <p className="brand">
        <Link href="/">Starforge</Link>
      </p>
      <h1>Page not found</h1>
      <p className="lede">
        No published CMS page matches this URL. Drafts stay private until you Publish them in{' '}
        <Link href="/admin">/admin</Link>.
      </p>
      <div className="links">
        <Link className="secondary" href="/">
          Back to home
        </Link>
      </div>
    </div>
  )
}