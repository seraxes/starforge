import React, { Fragment } from 'react'

import { getSiteSettings } from '@/core/settings'
import { ensureModulesRegistered } from '@/modules/catalog'

import { getAssignmentsForPosition } from './layout'
import { getRegisteredModule } from './registry'
import type { LayoutPositionId } from './types'

type Props = {
  position: LayoutPositionId
  className?: string
}

/**
 * Renders every enabled layout assignment for a named position.
 * Master gate: site-settings `features.modules`. Per-module `featureFlag` optional.
 * Any registered module may appear in any position — no hard locks.
 */
export async function ModuleSlot({ position, className }: Props) {
  ensureModulesRegistered()

  const settings = await getSiteSettings()
  if (!settings.features.modules) {
    return null
  }

  const assignments = getAssignmentsForPosition(position)
  if (assignments.length === 0) return null

  const nodes: React.ReactNode[] = []

  for (const assignment of assignments) {
    const mod = getRegisteredModule(assignment.moduleId)
    if (!mod) continue
    if (mod.featureFlag && !settings.features[mod.featureFlag]) continue

    const rendered = await mod.render({ position, settings })
    if (rendered == null || rendered === false) continue
    nodes.push(<Fragment key={`${assignment.moduleId}-${position}`}>{rendered}</Fragment>)
  }

  if (nodes.length === 0) return null

  return (
    <div
      className={className ? `sf-module-slot ${className}` : 'sf-module-slot'}
      data-sf-position={position}
    >
      {nodes}
    </div>
  )
}
