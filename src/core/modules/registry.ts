import type { StarforgeModule } from './types'

const modulesById = new Map<string, StarforgeModule>()

/**
 * Register an extension module. Call from `src/modules/catalog.ts` (or a
 * module’s own `register.ts`) during app boot — idempotent for the same id.
 */
export function registerModule(mod: StarforgeModule): void {
  if (!mod?.id || typeof mod.id !== 'string') {
    throw new Error('registerModule: module.id is required')
  }
  if (typeof mod.render !== 'function') {
    throw new Error(`registerModule(${mod.id}): render() is required`)
  }
  modulesById.set(mod.id, mod)
}

export function getRegisteredModule(id: string): StarforgeModule | undefined {
  return modulesById.get(id)
}

export function listRegisteredModules(): StarforgeModule[] {
  return [...modulesById.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** Test / seed helper — clears the in-memory registry. */
export function clearModuleRegistry(): void {
  modulesById.clear()
}
