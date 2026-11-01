import Link from 'next/link'
import React from 'react'

/** Public 404 — including missing Payload `home` page for `/`. */
export default function PublicNotFound() {
  return (
    <article className="cms-page">
      <header className="cms-page-header">
        <p className="brand">
          <Link href="/">Starforge</Link>
        </p>
        <h1>Page not found</h1>
      </header>
      <p className="lede">
        No published Payload page for this path. Seed creates slug <code>home</code> for{' '}
        <code>/</code> — run <code>npm run seed</code>, or publish a page in{' '}
        <Link href="/admin">CMS</Link>.
      </p>
      <p>
        <Link className="secondary" href="/">
          Back to home
        </Link>
      </p>
    </article>
  )
}
