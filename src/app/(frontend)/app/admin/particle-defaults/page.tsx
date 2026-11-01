import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { listLayoutOutlines } from '@/core/modules'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { LayoutsAdminNav } from '../layouts/layouts-admin-nav'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Particle Defaults — Layouts — Starforge',
  description: 'Gantry-like particle defaults (stub).',
}

type SearchParams = Promise<{ outline?: string | string[] }> | { outline?: string | string[] }

function pickOutlineParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_LAYOUT_ID
}

/**
 * Stub for Gantry “Particle Defaults” tab — wire typed defaults later.
 */
export default async function AdminParticleDefaultsPage(props: {
  searchParams?: SearchParams
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)) {
    redirect('/app/admin/settings')
  }

  const search = props.searchParams ? await props.searchParams : {}
  const requestedId = pickOutlineParam(search.outline)
  const outlines = await listLayoutOutlines()
  const known = outlines.some((o) => o.id === requestedId)
  const layoutId = known ? requestedId : DEFAULT_LAYOUT_ID
  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)

  return (
    <section className="admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="particle-defaults"
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={layoutId}
        showPageSettingsTab={pageSettingsOn}
      />
      <h2>Particle Defaults</h2>
      <p className="lede admin-lede">
        Stub — Gantry-style particle defaults will live here (typed Core particles + optional
        per-outline overrides). For now configure instances on the{' '}
        <Link
          href={
            layoutId === 'default'
              ? '/app/admin/layouts'
              : `/app/admin/layouts?outline=${encodeURIComponent(layoutId)}`
          }
        >
          Layout
        </Link>{' '}
        canvas.
      </p>
    </section>
  )
}
