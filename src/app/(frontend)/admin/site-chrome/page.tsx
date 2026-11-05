import React from 'react'
import Link from 'next/link'

import { getSiteChrome } from '@/core/site-chrome'
import { SiteChromeForm } from './site-chrome-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Chrome — Starforge',
  description:
    'Site offline, outbound email, metadata, robots, content rights, cookie scope, and Environment.',
}

export default async function AdminSiteChromePage() {
  const chrome = await getSiteChrome()

  return (
    <section className="admin-section">
      <h2>Chrome</h2>
      <p className="lede admin-lede">
        Site-wide policy and defaults — offline, SEO/metadata, cookies, outbound email, and
        Environment. Languages live under{' '}
        <Link href="/admin/localization">Localization</Link>. Captcha enable/provider moved to{' '}
        <Link href="/admin/settings/security">Settings → Security</Link>. Modules
        on/off under <Link href="/admin/settings">Settings → Modules</Link>; navigation
        sets under <Link href="/admin/nav">Navigation</Link>; document chrome / Font Awesome
        under <Link href="/admin/page-settings">Layouts → Page settings</Link>. Secrets stay in
        env — gated <Link href="/admin/site-chrome/environment">Environment</Link> writes{' '}
        <code>.env.local</code>, not this form or the database.
      </p>
      <SiteChromeForm chrome={chrome} />
    </section>
  )
}
