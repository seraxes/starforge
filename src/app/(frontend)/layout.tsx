import React from 'react'

import './styles.css'
/* Public Skin port — brand extras (tokens injected per-request via SkinRootStyles). */
import '@/core/skin/active.css'
/* Pack stylesheets (Rich Editor portals) — present only when that pack is allowlisted. */
import '@/generated/module-styles'

export const metadata = {
  description:
    'Starforge — reusable product core. Payload CMS is the content/media module only.',
  title: 'Starforge',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      {/* BodyAttributesClientImpl stamps skin/outline classes before hydration. */}
      <body suppressHydrationWarning>
        <main>{children}</main>
      </body>
    </html>
  )
}
