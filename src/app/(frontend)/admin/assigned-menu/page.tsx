import React from 'react'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { getLayoutOutline, listLayoutOutlines } from '@/core/modules'
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

import { AssignedMenuPanel } from '../layouts/assigned-menu-panel'
import { LayoutsAdminNav } from '../layouts/layouts-admin-nav'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Assigned Menu — Layouts — Starforge',
  description: 'Assign the active layout outline to navigation menu items.',
}

type SearchParams = Promise<{ outline?: string | string[] }> | { outline?: string | string[] }

export default async function AdminAssignedMenuPage(props: { searchParams?: SearchParams }) {
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
  const outlineMeta = (await getLayoutOutline(layoutId)) ?? {
    id: layoutId,
    label: layoutId,
  }

  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)

  return (
    <section className="admin-section layout-admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="assigned-menu"
        outlines={skinOutlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={layoutId}
        showPageSettingsTab={pageSettingsOn}
        skins={listSkins().map((s) => ({ id: s.id, label: s.label }))}
        activeSkinId={activeSkin.id}
        skinPinnedByEnv={isSkinPinnedByEnv()}
      />
      <h2>Assigned Menu</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Menu items that should use outline <strong>{outlineMeta.label}</strong> (
        <code>{layoutId}</code>). Toggle each item on or off — same assignment as Navigation → Layout
        outline.
      </p>
      <AssignedMenuPanel outlineId={layoutId} outlineLabel={outlineMeta.label} />
    </section>
  )
}
