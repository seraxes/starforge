import React from 'react'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { listLayoutOutlines } from '@/core/modules'
import { loadPageSettingsAdmin } from '@/core/page-settings/actions'
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
import { PageSettingsForm } from './page-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Page Settings — Starforge',
  description: 'Gantry-style document chrome: Head, Assets, Body, Font Awesome, Atoms.',
}

type Props = {
  searchParams: Promise<{ outline?: string }>
}

export default async function AdminPageSettingsPage({ searchParams }: Props) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)) {
    redirect('/admin/settings')
  }

  const params = await searchParams
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)

  const activeSkin = await getActiveSkin()
  if (layoutOn) {
    await ensureSkinOutlineSeeds(activeSkin.id)
  }
  const outlines = layoutOn ? await listLayoutOutlines() : []
  const skinOutlines = filterOutlinesForSkin(outlines, activeSkin.id)
  const layoutId = await resolveAdminWorkingOutlineId({
    requestedId: pickOutlineSearchParam(params.outline),
    skinId: activeSkin.id,
    preferredOutlineId: activeSkin.preferredDefaultOutlineId,
    outlines,
    fallbackId: DEFAULT_LAYOUT_ID,
  })

  const bootstrap = await loadPageSettingsAdmin(layoutId)

  return (
    <section className="admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="page-settings"
        outlines={
          skinOutlines.length
            ? skinOutlines.map((o) => ({ id: o.id, label: o.label }))
            : [{ id: DEFAULT_LAYOUT_ID, label: 'Base Outline' }]
        }
        currentOutlineId={layoutId}
        showOutlineSwitcher={layoutOn}
        showLayoutTabs={layoutOn}
        showPageSettingsTab
        skins={listSkins().map((s) => ({ id: s.id, label: s.label }))}
        activeSkinId={activeSkin.id}
        skinPinnedByEnv={isSkinPinnedByEnv()}
      />
      <h2 className="sr-only">Page Settings</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Document chrome follows the toolbar outline — same Inherit/Copy gate as Layout &amp;
        Styles. <strong>Base</strong> = source (no Inherit/Copy). Any other outline = Inherit /
        Copy from Base beside each field. Assign which outline a page uses on nav menu items.
      </p>
      <PageSettingsForm key={layoutId} bootstrap={bootstrap} />
    </section>
  )
}
