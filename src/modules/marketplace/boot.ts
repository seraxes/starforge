/**
 * product:marketplace process boot.
 *
 * Idempotent. Returns immediately when Marketplace is toggled off.
 * Registers marketplace.listingFeePaid on Payments (same pattern as Subscriptions).
 */
import { isCatalogBootEnabled } from '@/core/modules/module-boot'

export async function bootMarketplace(options?: {
  isEnabled?: () => Promise<boolean>
}): Promise<void> {
  try {
    const enabled = options?.isEnabled
      ? await options.isEnabled()
      : await (async () => {
          const { MODULE_IDS } = await import('@/core/settings')
          return isCatalogBootEnabled(MODULE_IDS.marketplace)
        })()
    if (!enabled) return

    const {
      ensureMarketplacePaymentHook,
      ensureMarketplacePaymentHookReady,
    } = await import('./payment-bridge')
    ensureMarketplacePaymentHook()
    await ensureMarketplacePaymentHookReady()
  } catch (error) {
    console.error('[marketplace] boot failed', error)
    /* pack missing / migrate pending */
  }
}
