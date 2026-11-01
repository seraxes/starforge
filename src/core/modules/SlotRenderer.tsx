import React from 'react'

import { canSeeNavAccessLevel, getAccessViewer } from '@/core/acl'
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
 * Slot `accessLevel` (public / registered / group:<id>) filters viewing like Nav tags.
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

  // Viewing filter — same group/public/registered tokens as Nav (SF-41).
  if (slot.accessLevel && slot.accessLevel !== 'public') {
    const viewer = await getAccessViewer()
    if (!canSeeNavAccessLevel(slot.accessLevel, viewer)) return null
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
      data-sf-access={slot.accessLevel || 'public'}
      style={style}
    >
      {rendered}
    </div>
  )
}
