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
 *
 * Each layout row stays its own horizontal flex row (same-row % widths).
 */
export async function ModuleSlot({ position, className }: Props) {
  const document = await getLayoutDocument()
  const section = document.sections.find((s) => s.id === position)
  if (!section) return null

  const rows = [...section.rows].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  )

  const rowNodes: React.ReactNode[] = []
  for (const row of rows) {
    const slots = [...row.slots].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )
    if (slots.length === 0) continue
    rowNodes.push(
      <div key={row.id} className="sf-grid-row" data-sf-row={row.id}>
        {slots.map((slot) => (
          <SlotRenderer key={slot.id} sectionId={section.id} slot={slot} />
        ))}
      </div>,
    )
  }

  if (rowNodes.length === 0) return null

  return (
    <div
      className={className ? `sf-module-slot ${className}` : 'sf-module-slot'}
      data-sf-position={position}
    >
      {rowNodes}
    </div>
  )
}
