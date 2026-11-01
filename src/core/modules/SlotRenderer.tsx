import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { canSeeNavAccessTags, resolveAccessTags } from '@/core/acl/nav-access'
import { getSiteSettings, isParticleModuleEnabled } from '@/core/settings'
import { ensureModulesRegistered } from '@/modules/catalog'

import { gridColStyle } from './grid'
import { getRegisteredModule } from './registry'
import type { LayoutPositionId, LayoutSlot } from './types'

type Props = {
  sectionId: LayoutPositionId
  slot: LayoutSlot
  pageContent?: React.ReactNode
}

/**
 * Renders one layout slot (particle) inside a grid cell.
 * Site Settings → Modules per-id toggles gate public render (required chrome always on).
 * Slot `accessTags` (public / registered / group:<id>) filter viewing like Nav (ANY match).
 */
export async function SlotRenderer({ sectionId, slot, pageContent }: Props) {
  if (slot.enabled === false) return null

  ensureModulesRegistered()
  const mod = getRegisteredModule(slot.moduleId)
  if (!mod) return null

  const settings = await getSiteSettings()
  if (
    !isParticleModuleEnabled(settings, mod.id, {
      builtin: mod.builtin,
      featureFlag: mod.featureFlag,
    })
  ) {
    return null
  }
  if (mod.featureFlag && mod.featureFlag !== 'modules' && !settings.features[mod.featureFlag]) {
    return null
  }
  // Core Form also requires the product:forms capability.
  if (mod.id === 'form') {
    const { MODULE_IDS, isCatalogModuleEnabled } = await import('@/core/settings')
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) return null
  }

  const accessTags = resolveAccessTags({
    accessTags: slot.accessTags,
    accessLevel: slot.accessLevel,
  })
  // Viewing filter — same multi-tag OR match as Nav (SF-45).
  if (!(accessTags.length === 1 && accessTags[0] === 'public')) {
    const viewer = await getAccessViewer()
    if (!canSeeNavAccessTags(accessTags, viewer)) return null
  }

  const rendered = await mod.render({
    position: sectionId,
    settings,
    slot,
    pageContent,
  })
  if (rendered == null || rendered === false) return null

  const style = gridColStyle(slot.width)

  return (
    <div
      className="sf-grid-col"
      data-sf-slot={slot.id}
      data-sf-module={slot.moduleId}
      data-sf-width={slot.width}
      data-sf-access={accessTags.join('|')}
      style={style}
    >
      {rendered}
    </div>
  )
}
