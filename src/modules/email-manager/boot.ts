/**
 * product:email-manager process boot.
 *
 * Idempotent. Returns immediately when Email Manager is toggled off, so the
 * broadcast drain job is not registered and due broadcasts are not kicked.
 *
 * One `kickDueBroadcasts` per call — the same single kick instrumentation
 * used to fire. That call is awaited inside the try/catch. The previous
 * `void kickDueBroadcasts()` did not observe an async rejection.
 * `listDueBroadcasts` still swallows a missing table, so a migrate-pending
 * database does not fail this boot.
 */
import { isCatalogBootEnabled } from '@/core/modules/module-boot'

export async function bootEmailManager(): Promise<void> {
  try {
    const { MODULE_IDS } = await import('@/core/settings')
    if (!(await isCatalogBootEnabled(MODULE_IDS.emailManager))) return
    const { ensureEmailBroadcastDrainJob, kickDueBroadcasts } = await import('./broadcast-engine')
    ensureEmailBroadcastDrainJob()
    await kickDueBroadcasts()
  } catch (error) {
    console.error('[email-manager] boot failed', error)
    /* pack missing / migrate pending */
  }
}
