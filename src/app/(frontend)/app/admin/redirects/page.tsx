import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { listRedirects } from '@/core/redirects'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { RedirectsManager } from './redirects-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Redirects — Starforge',
  description: 'SEO redirects (301/302) and public sitemap.xml over published pages.',
}

export default async function AdminRedirectsPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
    redirect('/app/admin/settings')
  }

  const redirects = await listRedirects()

  return (
    <section className="admin-section admin-layouts-padded">
      <h2>Redirects</h2>
      <p className="lede admin-lede">
        Map old paths to new ones (301 permanent / 302 temporary). Public{' '}
        <Link href="/sitemap.xml">/sitemap.xml</Link> lists published Payload pages when this module
        is on. Toggle under <Link href="/app/admin/settings">Settings → Modules</Link>.
      </p>
      <RedirectsManager
        redirects={redirects.map((r) => ({
          id: r.id,
          fromPath: r.fromPath,
          toUrl: r.toUrl,
          statusCode: r.statusCode,
          enabled: r.enabled,
          note: r.note,
          updatedAt: r.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
