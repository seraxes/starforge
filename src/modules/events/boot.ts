/**
 * product:events process boot.
 *
 * Idempotent. Returns immediately when Events is toggled off.
 *
 * While Events is off, the abandoned-checkout sweep is not armed
 * (`__sfEventsAbandonedCheckoutSweep` stays unset). Seats already stuck in
 * `pending_payment` are left untouched until Events is enabled and boot
 * runs again.
 *
 * `ensureEventsPaymentHook` also arms that sweep on a later microtask.
 * The explicit `ensureAbandonedCheckoutSweep` call is the boot owner.
 * The existing global guard blocks a second sweep.
 *
 * Each step runs as soon as its module has loaded. A later import failure
 * (for example the map catalog) does not skip the sweep or the preset.
 *
 * `options.isEnabled` is a unit-test seam. Production boot reads the
 * Events catalog toggle.
 */
import { isCatalogBootEnabled } from '@/core/modules/module-boot'

export async function bootEvents(options?: {
  isEnabled?: () => Promise<boolean>
}): Promise<void> {
  try {
    const enabled = options?.isEnabled
      ? await options.isEnabled()
      : await (async () => {
          const { MODULE_IDS } = await import('@/core/settings')
          return isCatalogBootEnabled(MODULE_IDS.events)
        })()
    if (!enabled) return

    const { ensureEventsFormHooks } = await import('./form-hooks')
    ensureEventsFormHooks()

    const { ensureEventsPaymentHook, ensureEventsPaymentHookReady } = await import(
      './payment-bridge'
    )
    ensureEventsPaymentHook()
    await ensureEventsPaymentHookReady()

    const { ensureAbandonedCheckoutSweep } = await import('./abandoned-checkout')
    ensureAbandonedCheckoutSweep()

    const { ensureEventsReminderJob } = await import('./email-emit')
    ensureEventsReminderJob()

    const { ensureEventsMapCatalog } = await import('./map-catalog')
    ensureEventsMapCatalog()

    const { ensureEventRegistrationFormSeeded } = await import('./registration-form')
    await ensureEventRegistrationFormSeeded()
  } catch (error) {
    console.error('[events] boot failed', error)
    /* pack missing / migrate pending */
  }
}
