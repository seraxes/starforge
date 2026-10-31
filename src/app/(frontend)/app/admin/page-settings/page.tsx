import React from 'react'
import Link from 'next/link'

import { loadPageSettingsAdmin } from '@/core/page-settings/actions'

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
  const params = await searchParams
  const editingPageKey = params.page?.trim() || null
  const bootstrap = await loadPageSettingsAdmin(editingPageKey)

  return (
    <section className="admin-section">
      <h2>Page Settings</h2>
      <p className="lede admin-lede">
        Site defaults and per-page overrides for document chrome (meta, assets, body, Font Awesome,
        atoms) plus layout assignment — Gantry Page Settings style. Public pages merge page →
        global. Layout canvas:{' '}
        <Link href="/app/admin/layouts">Layout manager</Link>.
      </p>
      <PageSettingsForm bootstrap={bootstrap} />
    </section>
  )
}
