/**
 * product:subscriptions process boot.
 *
 * Idempotent. Returns immediately when Subscriptions is toggled off, so the
 * collect resolver, expiry sweep, and registration form seed do not run.
 * Payments does not register this pack.
 *
 * `ensureSubscriptionsPaymentHook` starts the Payments hook (including the
 * collect resolver) and the email starters. Awaiting the existing ready
 * promise finishes that registration before boot returns. It does not
 * register the hook a second time.
 */
import { isCatalogBootEnabled } from '@/core/modules/module-boot'

export async function bootSubscriptions(): Promise<void> {
  try {
    const { MODULE_IDS } = await import('@/core/settings')
    if (!(await isCatalogBootEnabled(MODULE_IDS.subscriptions))) return
    const {
      ensureSubscriptionRegistrationFormSeeded,
      ensureSubscriptionsExpiryJob,
      ensureSubscriptionsPaymentHook,
      ensureSubscriptionsPaymentHookReady,
      resolveAudience,
    } = await import('./api')
    const { registerMemberAudienceResolver } = await import('@/core/modules/member-audience')
    registerMemberAudienceResolver(async (userId) => {
      const audience = await resolveAudience(userId)
      return { entitlementKeys: audience.entitlementKeys, groupIds: audience.groupIds }
    })
    ensureSubscriptionsPaymentHook()
    await ensureSubscriptionsPaymentHookReady()
    ensureSubscriptionsExpiryJob()
    await ensureSubscriptionRegistrationFormSeeded()
  } catch (error) {
    console.error('[subscriptions] boot failed', error)
    /* pack missing / migrate pending */
  }
}
