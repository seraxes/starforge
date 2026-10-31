import { analyticsAtom } from './analytics'
import { customCssJsAtom } from './custom-css-js'
import {
  clearAtomRegistry,
  getRegisteredAtom,
  listRegisteredAtoms,
  registerAtom,
} from './registry'

let builtinsRegistered = false

/** Idempotent — register v1 atoms (Custom CSS/JS + Analytics). */
export function ensureAtomsRegistered(): void {
  if (builtinsRegistered) return
  registerAtom(customCssJsAtom)
  registerAtom(analyticsAtom)
  builtinsRegistered = true
}

export {
  analyticsAtom,
  clearAtomRegistry,
  customCssJsAtom,
  getRegisteredAtom,
  listRegisteredAtoms,
  registerAtom,
}
