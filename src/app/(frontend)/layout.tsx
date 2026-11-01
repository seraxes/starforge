import React from 'react'

import './styles.css'
import './admin-dark.css'

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
