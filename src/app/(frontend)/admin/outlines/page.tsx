import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { listLayoutOutlines, loadLayoutDocument } from '@/core/modules'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  ensureSkinOutlineSeeds,
  getActiveSkin,
  isSkinPinnedByEnv,
  listSkins,
} from '@/core/skin'

import { LayoutsAdminNav } from '../layouts/layouts-admin-nav'
import { OutlinesManager } from './outlines-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Outlines — Layouts — Starforge',
  description: 'Skin outline pack — Base shell + inheriting children.',
}

export default async function AdminOutlinesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)) {
    redirect('/admin/settings')
  }

  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
  const activeSkin = await getActiveSkin()
  // Idempotent — seeds Base/Offline, soft-heals skin_id + Base label.
  await ensureSkinOutlineSeeds(activeSkin.id)

  const outlines = await listLayoutOutlines()
  const skins = listSkins()
  const baseOutlineId =
    (typeof activeSkin.preferredDefaultOutlineId === 'string' &&
      activeSkin.preferredDefaultOutlineId.trim()) ||
    activeSkin.outlineSeeds?.find((s) => s.defaultForSite)?.id ||
    null

  return (
    <section className="admin-section layout-admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="layout"
        outlines={outlines.map((o) => ({ id: o.id, label: o.label }))}
        currentOutlineId={baseOutlineId || DEFAULT_LAYOUT_ID}
        showPageSettingsTab={pageSettingsOn}
        skins={skins.map((s) => ({ id: s.id, label: s.label }))}
        activeSkinId={activeSkin.id}
        skinPinnedByEnv={isSkinPinnedByEnv()}
      />
      <h2>Layout outlines</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Outlines for skin{' '}
        <Link href="/admin/skins">
          <strong>{activeSkin.label}</strong>
        </Link>
        . <strong>Base</strong> is the shell every new outline inherits from. Create / duplicate
        under this skin keeps the Skin tag and inherits Base by default. Assign under{' '}
        <Link href="/admin/page-settings">Page settings</Link>.
      </p>
      <OutlinesManager
        activeSkinId={activeSkin.id}
        activeSkinLabel={activeSkin.label}
        baseOutlineId={baseOutlineId}
        outlines={await Promise.all(
          outlines.map(async (o) => {
            const { document } = await loadLayoutDocument(o.id)
            const inheritFrom =
              typeof document.inheritFrom === 'string' ? document.inheritFrom.trim() : ''
            const isSkinBase = Boolean(baseOutlineId && o.id === baseOutlineId)
            return {
              id: o.id,
              label: o.label,
              updatedAt: o.updatedAt.toISOString(),
              isCoreDefault: o.id === DEFAULT_LAYOUT_ID,
              isSkinBase,
              inheritFrom: inheritFrom || null,
              skinId: o.skinId,
              skinOwned: o.skinId === activeSkin.id,
            }
          }),
        )}
      />
    </section>
  )
}
