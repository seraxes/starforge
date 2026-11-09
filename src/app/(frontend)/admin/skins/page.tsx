import React from 'react'

import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { listLayoutOutlines } from '@/core/modules'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import {
  ensureSkinOutlineSeeds,
  filterOutlinesForSkin,
  getActiveSkin,
  getStoredDefaultSkinId,
  isSkinPinnedByEnv,
  listSkins,
  resolveAdminWorkingOutlineId,
} from '@/core/skin'

import { LayoutsAdminNav } from '../layouts/layouts-admin-nav'
import { SkinsManager } from './skins-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Skins — Layouts — Starforge',
  description: 'Installed public skins — upload / download YAML packs, set site default.',
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

  if (layoutOn) {
    await ensureSkinOutlineSeeds(activeSkin.id)
  }
  const outlines = layoutOn ? await listLayoutOutlines() : []
  const skinOutlines = filterOutlinesForSkin(outlines, activeSkin.id)
  const currentOutlineId = await resolveAdminWorkingOutlineId({
    requestedId: '',
    skinId: activeSkin.id,
    preferredOutlineId: activeSkin.preferredDefaultOutlineId,
    outlines,
    fallbackId: DEFAULT_LAYOUT_ID,
  })

  return (
    <section className="admin-section layout-admin-section admin-layouts-padded">
      <LayoutsAdminNav
        active="skins"
        outlines={
          skinOutlines.length
            ? skinOutlines.map((o) => ({ id: o.id, label: o.label }))
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
        Installed skins for the public site. Active:{' '}
        <strong>{activeSkin.label}</strong> (<code>{activeSkin.id}</code>). Upload a YAML skin
        pack to install, or download a pack (tokens + live outlines) to move work to another
        Starforge site.
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
          source: skin.source,
        }))}
      />
    </section>
  )
}
