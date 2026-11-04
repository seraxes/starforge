import React, { type ComponentType } from 'react'

import {
  loadPublicShellSlot,
  type PublicShellSlot,
} from '@/generated/module-registry.server'

type PublicShellSlotsProps = {
  slot: PublicShellSlot
}

/**
 * Core host for module `publicShell` contributions.
 * Renders allowlisted lazy components for the given slot (head / bodyStart / bodyEnd).
 */
export async function PublicShellSlots({ slot }: PublicShellSlotsProps) {
  const entries = await loadPublicShellSlot(slot)
  if (entries.length === 0) return null

  return (
    <>
      {entries.map(({ moduleId, Component }) => {
        const Shell = Component as ComponentType
        return <Shell key={moduleId} />
      })}
    </>
  )
}
