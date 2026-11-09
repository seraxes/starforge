import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { listLayoutOutlines } from '@/core/modules'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  ensureSkinOutlineSeeds,
  filterOutlinesForSkin,
  getActiveSkin,
  isSkinPinnedByEnv,
  listSkins,
  pickOutlineSearchParam,
  resolveAdminWorkingOutlineId,
} from '@/core/skin'

import { LayoutsAdminNav } from '../layouts/layouts-admin-nav'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Particle Defaults — Layouts — Starforge',
  description: 'Gantry-like particle defaults (stub).',
}

type SearchParams = Promise<{ outline?: string | string[] }> | { outline?: string | string[] }

/**
 * Stub for Gantry “Particle Defaults” tab — wire typed defaults later.
 */
export default async function AdminParticleDefaultsPage(props: {
  searchParams?: SearchParams
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)) {
    redirect('/admin/settings')
  }

  const search = props.searchParams ? await props.searchParams : {}
  const requestedId = pickOutlineSearchParam(search.outline)
  const activeSkin = await getActiveSkin()
  await ensureSkinOutlineSeeds(activeSkin.id)
  const outlines = await listLayoutOutlines()
  const skinOutlines = filterOutlinesForSkin(outlines, activeSkin.id)
  const layoutId = await resolveAdminWorkingOutlineId({
    requestedId,
    skinId: activeSkin.id,
    preferredOutlineId: activeSkin.preferredDefaultOutlineId,
    outlines,
    fallbackId: DEFAULT_LAYOUT_ID,
  })
  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)

  return (
    <section className="admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="particle-defaults"
        outlines={skinOutlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={layoutId}
        showPageSettingsTab={pageSettingsOn}
        skins={listSkins().map((s) => ({ id: s.id, label: s.label }))}
        activeSkinId={activeSkin.id}
        skinPinnedByEnv={isSkinPinnedByEnv()}
      />
      <h2>Particle Defaults</h2>
      <p className="lede admin-lede">
        Stub — Gantry-style particle defaults will live here (typed Core particles + optional
        per-outline overrides). For now configure instances on the{' '}
        <Link
          href={
            layoutId === 'default'
              ? '/admin/layouts'
              : `/admin/layouts?outline=${encodeURIComponent(layoutId)}`
          }
        >
          Layout
        </Link>{' '}
        canvas.
      </p>
    </section>
  )
}
