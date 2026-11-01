import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { listLayoutOutlines } from '@/core/modules'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { OutlinesManager } from './outlines-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Outlines — Starforge',
  description: 'Gantry-like layout outlines — named layouts, copy, rename, open in Layout.',
}

export default async function AdminOutlinesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)) {
    redirect('/app/admin/settings')
  }

  const outlines = await listLayoutOutlines()

  return (
    <section className="admin-section admin-layouts-padded">
      <h2>Layout outlines</h2>
      <p className="lede admin-lede">
        Gantry-style <strong>outlines</strong> are named layout documents stored in{' '}
        <code>sf_layouts</code>. Create, rename, or duplicate an outline, then{' '}
        <strong>Select</strong> to open it in the{' '}
        <Link href={`/app/admin/layouts?outline=${DEFAULT_LAYOUT_ID}`}>Layout</Link> canvas. Assign
        outlines to pages under{' '}
        <Link href="/app/admin/page-settings">Page settings → Layout assignment</Link>.
      </p>
      <OutlinesManager
        outlines={outlines.map((o) => ({
          id: o.id,
          label: o.label,
          updatedAt: o.updatedAt.toISOString(),
          isDefault: o.id === DEFAULT_LAYOUT_ID,
        }))}
      />
    </section>
  )
}
