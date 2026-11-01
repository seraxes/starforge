import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { loadPageSettingsAdmin } from '@/core/page-settings/actions'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { PageSettingsForm } from './page-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Page Settings — Starforge',
  description: 'Gantry-style document chrome: Head, Assets, Body, Font Awesome, Atoms, layout.',
}

type Props = {
  searchParams: Promise<{ page?: string }>
}

export default async function AdminPageSettingsPage({ searchParams }: Props) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)) {
    redirect('/app/admin/settings')
  }

  const params = await searchParams
  const editingPageKey = params.page?.trim() || null
  const bootstrap = await loadPageSettingsAdmin(editingPageKey)

  return (
    <section className="admin-section admin-layouts-full">
      <h2>Page Settings</h2>
      <p className="lede admin-lede">
        Site defaults and per-page overrides for document chrome (meta, assets, body, Font Awesome,
        atoms), layout assignment, and <strong>Who can see</strong> viewing tags (same groups as
        Nav / Layout — match ANY; empty = public). Public pages merge page → global; restricted
        pages hide for unmatched viewers. Layout canvas:{' '}
        <Link href="/app/admin/layouts">Layout manager</Link>.
      </p>
      <PageSettingsForm bootstrap={bootstrap} />
    </section>
  )
}
