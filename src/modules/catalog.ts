import { builtinParticles } from '@/core/modules/particles'
import { clearModuleRegistry, registerModule } from '@/core/modules/registry'
import {
  ALLOWLISTED_BUILTIN_PARTICLE_IDS,
  isModuleAllowlisted,
  loadAllowlistedOptionalParticles,
} from '@/generated/module-registry'

let registered = false
let registering: Promise<void> | null = null

/**
 * Boot the particle registry once per process.
 * Built-in particles register from core (allowlist-filtered).
 * Optional packs (Form, Notice, …) load only via the generated allowlist
 * dynamic import() loaders — absent packs are not eager-imported.
 */
export async function ensureModulesRegistered(): Promise<void> {
  if (registered) return
  if (registering) return registering

  registering = (async () => {
    const builtinAllow = new Set(ALLOWLISTED_BUILTIN_PARTICLE_IDS)
    for (const particle of builtinParticles) {
      if (!builtinAllow.has(particle.id) && !isModuleAllowlisted(particle.id)) continue
      registerModule(particle)
    }

    const optionals = await loadAllowlistedOptionalParticles()
    for (const mod of optionals) {
      if (!isModuleAllowlisted(mod.id)) continue
      registerModule(mod)
    }

    registered = true
  })()

  try {
    await registering
  } finally {
    registering = null
  }
}

/** Test helper — clears registry + registration gate. */
export function resetModulesRegistrationForTests(): void {
  registered = false
  registering = null
  clearModuleRegistry()
}
