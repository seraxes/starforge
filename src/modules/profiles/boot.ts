/**
 * product:profiles process boot.
 * Idempotent. Returns immediately when Profiles is toggled off.
 */
import { isCatalogBootEnabled } from '@/core/modules/module-boot'

export async function bootProfiles(): Promise<void> {
  try {
    const { MODULE_IDS } = await import('@/core/settings')
    if (!(await isCatalogBootEnabled(MODULE_IDS.profiles))) return
    const { ensureProfileFormSeeded } = await import('./profile-form')
    await ensureProfileFormSeeded()
  } catch (error) {
    console.error('[profiles] boot failed', error)
    /* pack missing / migrate pending */
  }
}
