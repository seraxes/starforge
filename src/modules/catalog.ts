import { builtinParticles } from '@/core/modules/particles'
import { registerModule } from '@/core/modules/registry'

import { noticeBarModule } from './notice-bar'

let registered = false

/**
 * Boot the extension catalog once per process.
 * Built-in particles (page-content, site-header, custom) register first.
 */
export function ensureModulesRegistered(): void {
  if (registered) return
  for (const particle of builtinParticles) {
    registerModule(particle)
  }
  registerModule(noticeBarModule)
  registered = true
}
