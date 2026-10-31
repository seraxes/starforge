import React from 'react'

import { getLayoutDocument } from './layout'
import { SlotRenderer } from './SlotRenderer'
import type { LayoutPositionId } from './types'

type Props = {
  position: LayoutPositionId
  className?: string
}

/**
 * Back-compat helper: render every enabled slot whose section id matches
 * `position` (v3 sections are the Gantry-style positions).
 * Prefer `PublicLayoutBody` for full-document rendering.
 */
export async function ModuleSlot({ position, className }: Props) {
  const document = await getLayoutDocument()
  const section = document.sections.find((s) => s.id === position)
  if (!section) return null

  const nodes: React.ReactNode[] = []
  for (const row of section.rows) {
    for (const slot of row.slots) {
      nodes.push(
        <SlotRenderer key={slot.id} sectionId={section.id} slot={slot} />,
      )
    }
  }

  if (nodes.length === 0) return null

  return (
    <div
      className={className ? `sf-module-slot ${className}` : 'sf-module-slot'}
      data-sf-position={position}
    >
      <div className="sf-grid-row">{nodes}</div>
    </div>
  )
}
