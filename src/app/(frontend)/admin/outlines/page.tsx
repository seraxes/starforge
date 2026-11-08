import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { listLayoutOutlines } from '@/core/modules'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  findSkinIdForOutline,
  getActiveSkin,
  isSkinPinnedByEnv,
  listSkins,
} from '@/core/skin'

import { LayoutsAdminNav } from '../layouts/layouts-admin-nav'
import { OutlinesManager } from './outlines-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Outlines — Layouts — Starforge',
  description: 'Gantry-like layout outlines — named layouts, copy, rename, open in Layout.',
}

export default async function AdminOutlinesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)) {
    redirect('/admin/settings')
  }

  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
  const [outlines, activeSkin] = await Promise.all([listLayoutOutlines(), getActiveSkin()])
  const skins = listSkins()

  return (
    <section className="admin-section layout-admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="layout"
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={DEFAULT_LAYOUT_ID}
        showPageSettingsTab={pageSettingsOn}
        skins={skins.map((s) => ({ id: s.id, label: s.label }))}
        activeSkinId={activeSkin.id}
        skinPinnedByEnv={isSkinPinnedByEnv()}
      />
      <h2>Layout outlines</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Gantry-style <strong>outlines</strong> for skin{' '}
        <Link href="/admin/skins">
          <strong>{activeSkin.label}</strong>
        </Link>
        . Create, rename, or duplicate, then <strong>Select</strong> to open the{' '}
        <Link href={`/admin/layouts?outline=${DEFAULT_LAYOUT_ID}`}>Layout</Link> canvas. Assign
        outlines under <Link href="/admin/page-settings">Page settings</Link>.
      </p>
      <OutlinesManager
        outlines={outlines.map((o) => ({
          id: o.id,
          label: o.label,
          updatedAt: o.updatedAt.toISOString(),
          isDefault: o.id === DEFAULT_LAYOUT_ID,
          skinId: findSkinIdForOutline(o.id, skins),
          skinOwned: findSkinIdForOutline(o.id, skins) === activeSkin.id,
        }))}
      />
    </section>
  )
}
