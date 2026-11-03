import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { listRedirects } from '@/core/redirects'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { RedirectsManager } from './redirects-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Redirects — Starforge',
  description: 'URL redirects (from → to + status) for the public site.',
}

export default async function AdminRedirectsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
    redirect('/app/admin/settings')
  }

  const rows = await listRedirects()

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Redirects</h2>
      <p className="lede admin-lede">
        Map old public paths to new ones (301 / 302 / 307 / 308). Middleware applies enabled rules
        before the page renders. Sitemap of published pages is always at{' '}
        <Link href="/sitemap.xml">/sitemap.xml</Link>. Module on/off under{' '}
        <Link href="/app/admin/settings">Settings → Modules</Link>. Run{' '}
        <code>npm run db:core:push</code> after pull so <code>sf_redirects</code> exists.
      </p>

      <RedirectsManager
        redirects={rows.map((r) => ({
          id: r.id,
          fromPath: r.fromPath,
          toPath: r.toPath,
          statusCode: r.statusCode,
          enabled: r.enabled,
          note: r.note,
          updatedAt: r.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
