import React from 'react'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { listLayoutOutlines } from '@/core/modules'
import { loadPageSettingsAdmin } from '@/core/page-settings/actions'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { LayoutsAdminNav } from '../layouts/layouts-admin-nav'
import { PageSettingsForm } from './page-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Page Settings — Starforge',
  description: 'Gantry-style document chrome: Head, Assets, Body, Font Awesome, Atoms, layout.',
}

type Props = {
  searchParams: Promise<{ page?: string; outline?: string }>
}

export default async function AdminPageSettingsPage({ searchParams }: Props) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)) {
    redirect('/app/admin/settings')
  }

  const params = await searchParams
  const editingPageKey = params.page?.trim() || null
  const bootstrap = await loadPageSettingsAdmin(editingPageKey)
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)

  const outlines = layoutOn ? await listLayoutOutlines() : []
  const requestedOutline = params.outline?.trim() || DEFAULT_LAYOUT_ID
  const layoutId = outlines.some((o) => o.id === requestedOutline)
    ? requestedOutline
    : DEFAULT_LAYOUT_ID

  return (
    <section className="admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="page-settings"
        outlines={
          outlines.length
            ? outlines.map((o) => ({ id: o.id, label: o.label }))
            : [{ id: DEFAULT_LAYOUT_ID, label: 'Base Outline' }]
        }
        currentOutlineId={layoutId}
        showOutlineSwitcher={layoutOn}
        showLayoutTabs={layoutOn}
        showPageSettingsTab
      />
      <h2 className="sr-only">Page Settings</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Site defaults and per-page overrides for document chrome, layout assignment, and{' '}
        <strong>Who can see</strong> tags (match ANY; empty = public).
      </p>
      <PageSettingsForm bootstrap={bootstrap} />
    </section>
  )
}
