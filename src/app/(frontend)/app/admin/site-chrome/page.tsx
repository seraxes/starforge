import React from 'react'
import Link from 'next/link'

import { getSiteChrome } from '@/core/site-chrome'
import { SiteChromeForm } from './site-chrome-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site Chrome — Starforge',
  description:
    'Site offline, captcha defaults, outbound email, metadata, robots, content rights, and cookie scope.',
}

export default async function AdminSiteChromePage() {
  const chrome = await getSiteChrome()

  return (
    <section className="admin-section">
      <h2>Site Chrome</h2>
      <p className="lede admin-lede">
        Site-wide policy and defaults — not Modules, not Navigation, not per-page Page settings.
        Modules on/off lives under <Link href="/app/admin/settings">Site settings</Link>; navigation
        sets under <Link href="/app/admin/nav">Navigation</Link>; document chrome under{' '}
        <Link href="/app/admin/page-settings">Page settings</Link>. Outbound email enable /
        provider / From live here; secrets stay in env — gated{' '}
        <Link href="/app/admin/site-chrome/environment">Environment</Link> writes{' '}
        <code>.env.local</code>, not this form or the database.
      </p>
      <SiteChromeForm chrome={chrome} />
    </section>
  )
}
