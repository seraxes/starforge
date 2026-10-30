import React from 'react'

import './styles.css'

export default function HomePage() {
  return (
    <div className="home">
      <div className="content">
        <p className="brand">Starforge</p>
        <h1>Core + content module scaffold</h1>
        <p className="lede">
          Product APIs and auth live in Starforge core. Payload CMS handles editorial
          content and media only.
        </p>
        <div className="links">
          <a className="primary" href="/admin">
            Open Payload admin
          </a>
          <a className="secondary" href="/api/health">
            Core health API
          </a>
        </div>
      </div>
      <div className="footer">
        <p>
          Architecture notes: <code>src/core/</code> (app) · <code>src/collections/</code>{' '}
          (CMS) · see README
        </p>
      </div>
    </div>
  )
}
