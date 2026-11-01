import React from 'react'
import Link from 'next/link'

type Props = {
  siteName: string
  message: string
}

/** Public offline screen when Site Chrome offline mode is on. */
export function SiteOffline({ siteName, message }: Props) {
  return (
    <main className="sf-offline" data-sf-offline="">
      <div className="sf-offline-inner">
        <p className="brand sf-offline-brand">{siteName}</p>
        <h1>Site offline</h1>
        <p className="lede">{message}</p>
        <p className="sf-offline-login">
          <Link href="/login">Admin sign in</Link>
        </p>
      </div>
    </main>
  )
}
