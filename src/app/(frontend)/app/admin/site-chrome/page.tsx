import React from 'react'
import Link from 'next/link'

import { getSiteChrome } from '@/core/site-chrome'
import { SiteChromeForm } from './site-chrome-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site Chrome — Starforge',
  description:
    'Site offline, captcha defaults, metadata, robots, content rights, and cookie scope.',
}

export default async function AdminSiteChromePage() {
  const chrome = await getSiteChrome()

  return (
    <section className="admin-section">
      <h2>Site Chrome</h2>
      <p className="lede admin-lede">
        Site-wide policy and defaults — not Modules, not Nav, not per-page Page settings. Modules
        on/off lives under <Link href="/app/admin/settings">Site settings</Link>; navigation sets
        under <Link href="/app/admin/nav">Nav</Link>; document chrome under{' '}
        <Link href="/app/admin/page-settings">Page settings</Link>.
      </p>
      <SiteChromeForm chrome={chrome} />
    </section>
  )
}
