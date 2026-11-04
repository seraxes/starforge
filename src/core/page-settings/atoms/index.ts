import { isModuleAllowlisted } from '@/generated/module-registry'
import { loadAllowlistedAtoms } from '@/generated/module-registry.server'

import {
  clearAtomRegistry,
  getRegisteredAtom,
  listRegisteredAtoms,
  registerAtom,
} from './registry'

let builtinsRegistered = false
let registering: Promise<void> | null = null

/**
 * Idempotent — register allowlisted Page Settings atoms via generated dynamic imports.
 * Atoms omitted from `starforge.modules.json` are not eager-imported.
 */
export async function ensureAtomsRegistered(): Promise<void> {
  if (builtinsRegistered) return
  if (registering) return registering

  registering = (async () => {
    const atoms = await loadAllowlistedAtoms()
    for (const atom of atoms) {
      const toggleId = atom.type.startsWith('atom:') ? atom.type : `atom:${atom.type}`
      if (!isModuleAllowlisted(toggleId) && !isModuleAllowlisted(atom.type)) continue
      registerAtom(atom)
    }
    builtinsRegistered = true
  })()

  try {
    await registering
  } finally {
    registering = null
  }
}

/** Test helper. */
export function resetAtomsRegistrationForTests(): void {
  builtinsRegistered = false
  registering = null
  clearAtomRegistry()
}

export {
  clearAtomRegistry,
  getRegisteredAtom,
  listRegisteredAtoms,
  registerAtom,
}
