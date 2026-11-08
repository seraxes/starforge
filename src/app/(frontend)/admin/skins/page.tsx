import React from 'react'
import Link from 'next/link'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { listLayoutOutlines } from '@/core/modules'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  getActiveSkin,
  getStoredDefaultSkinId,
  isSkinPinnedByEnv,
  listSkinOutlineSeeds,
  listSkins,
} from '@/core/skin'

import { LayoutsAdminNav } from '../layouts/layouts-admin-nav'
import { SkinsManager } from './skins-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Skins — Layouts — Starforge',
  description: 'Public skins — brand tokens, CSS, and layout outline seeds.',
}

export default async function AdminSkinsPage() {
  const settings = await getSiteSettings()
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)
  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)

  const skins = listSkins()
  const activeSkin = await getActiveSkin()
  const envPinned = isSkinPinnedByEnv()
  let defaultSkinId = activeSkin.id
  try {
    defaultSkinId = await getStoredDefaultSkinId()
  } catch {
    // sf_module_settings may be missing until migrate
  }

  const outlines = layoutOn ? await listLayoutOutlines() : []
  const preferredOutline =
    activeSkin.preferredDefaultOutlineId ||
    listSkinOutlineSeeds(activeSkin)[0]?.id ||
    DEFAULT_LAYOUT_ID
  const currentOutlineId = outlines.some((o) => o.id === preferredOutline)
    ? preferredOutline
    : outlines[0]?.id || DEFAULT_LAYOUT_ID

  return (
    <section className="admin-section layout-admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="skins"
        outlines={
          outlines.length
            ? outlines.map((o) => ({ id: o.id, label: o.label }))
            : [{ id: DEFAULT_LAYOUT_ID, label: 'Default' }]
        }
        currentOutlineId={currentOutlineId}
        showOutlineSwitcher={layoutOn}
        showLayoutTabs={layoutOn}
        showPageSettingsTab={pageSettingsOn}
        skins={skins.map((s) => ({ id: s.id, label: s.label }))}
        activeSkinId={activeSkin.id}
        skinPinnedByEnv={envPinned}
      />
      <h2>Skins</h2>
      <p className="lede admin-lede gantry-layouts-lede">
        Active skin <strong>{activeSkin.label}</strong> (<code>{activeSkin.id}</code>). A Skin is
        the Gantry-like theme package: brand tokens/CSS plus outline seeds. Set the site default
        below — seeds install into{' '}
        {layoutOn ? <Link href="/admin/outlines">Outlines</Link> : 'Outlines'} and Page Settings
        layout assignment follows the preferred outline.
      </p>
      <SkinsManager
        activeSkinId={activeSkin.id}
        envPinned={envPinned}
        previewHref="/"
        skins={skins.map((skin) => ({
          id: skin.id,
          label: skin.label,
          colorScheme: skin.colorScheme,
          isDefault: skin.id === defaultSkinId,
          isActive: skin.id === activeSkin.id,
          preferredOutlineId: skin.preferredDefaultOutlineId,
          outlines: listSkinOutlineSeeds(skin).map((seed) => ({
            id: seed.id,
            label: seed.label,
            defaultForSite: seed.defaultForSite,
          })),
        }))}
      />
    </section>
  )
}
