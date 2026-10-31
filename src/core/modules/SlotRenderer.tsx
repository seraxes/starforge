import React from 'react'

import { getSiteSettings } from '@/core/settings'
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
 * Renders one layout slot (particle) inside a 12-col grid cell.
 * Built-ins ignore the Modules master toggle; extensions still respect it.
 */
export async function SlotRenderer({ sectionId, slot, pageContent }: Props) {
  if (slot.enabled === false) return null

  ensureModulesRegistered()
  const mod = getRegisteredModule(slot.moduleId)
  if (!mod) return null

  const settings = await getSiteSettings()
  if (!mod.builtin && !settings.features.modules) return null
  if (mod.featureFlag && !settings.features[mod.featureFlag]) return null

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
      style={style}
    >
      {rendered}
    </div>
  )
}
