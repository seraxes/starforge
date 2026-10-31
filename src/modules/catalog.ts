import { registerModule } from '@/core/modules/registry'

import { noticeBarModule } from './notice-bar'

let registered = false

/**
 * Boot the extension catalog once per process.
 * Public layout calls this before rendering `ModuleSlot`s.
 */
export function ensureModulesRegistered(): void {
  if (registered) return
  registerModule(noticeBarModule)
  registered = true
}
