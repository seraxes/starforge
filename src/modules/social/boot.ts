/**
 * product:social process boot.
 *
 * Idempotent. Returns immediately when Social is toggled off, so social.sweep
 * is not armed. Slice 12 registers the challenge handler on that job.
 *
 * `options.isEnabled` is a unit-test seam. Production boot reads the
 * Social catalog toggle.
 */
import { isCatalogBootEnabled } from '@/core/modules/module-boot'

export async function bootSocial(options?: {
  isEnabled?: () => Promise<boolean>
}): Promise<void> {
  try {
    const enabled = options?.isEnabled
      ? await options.isEnabled()
      : await (async () => {
          const { MODULE_IDS } = await import('@/core/settings')
          return isCatalogBootEnabled(MODULE_IDS.social)
        })()
    if (!enabled) return

    const { ensureSocialSweep } = await import('./sweep')
    ensureSocialSweep()
  } catch (error) {
    console.error('[social] boot failed', error)
    /* pack missing / migrate pending */
  }
}
