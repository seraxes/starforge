import { ensureAtomsRegistered, listRegisteredAtoms } from '@/core/page-settings/atoms'
import { listRegisteredModules } from '@/core/modules/registry'
import { ensureModulesRegistered } from '@/modules/catalog'

import {
  REQUIRED_MODULE_IDS,
  atomToggleId,
  type ModuleCatalogItem,
} from './module-toggles'

/**
 * Installed catalog for Site Settings → Modules (P0).
 * Particles from `registerModule` + atoms from `registerAtom`.
 */
export function listInstalledModuleCatalog(): ModuleCatalogItem[] {
  ensureModulesRegistered()
  ensureAtomsRegistered()

  const particles: ModuleCatalogItem[] = listRegisteredModules().map((mod) => {
    const required = REQUIRED_MODULE_IDS.has(mod.id)
    const legacyOffByDefault = mod.featureFlag === 'modules'
    return {
      id: mod.id,
      kind: 'particle' as const,
      label: mod.name,
      description: mod.description?.trim() || (mod.builtin ? 'Built-in layout particle' : 'Extension module'),
      required,
      defaultEnabled: required || !legacyOffByDefault,
      installed: true as const,
    }
  })

  const atoms: ModuleCatalogItem[] = listRegisteredAtoms().map((atom) => ({
    id: atomToggleId(atom.type),
    kind: 'atom' as const,
    label: atom.label,
    description: atom.description?.trim() || `Page Settings atom (${atom.type})`,
    required: false,
    defaultEnabled: true,
    installed: true as const,
  }))

  return [...particles, ...atoms].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'particle' ? -1 : 1
    return a.label.localeCompare(b.label)
  })
}
