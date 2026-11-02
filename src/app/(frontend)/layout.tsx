import React from 'react'

import './styles.css'
/* Active admin theme (port): import the theme sheet directly — nested CSS @import
 * via active-core.css was unreliable in Next/Turbopack and left Core admin unstyled. */
import '@/core/admin-theme/themes/starforge-gantry/core-chrome.css'

export const metadata = {
  description:
    'Starforge — reusable product core. Payload CMS is the content/media module only.',
  title: 'Starforge',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
