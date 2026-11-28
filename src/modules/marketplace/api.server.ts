/**
 * product:marketplace server door.
 *
 *   import { MARKETPLACE_MODULE_ID, runMarketplaceDoor } from '@/modules/marketplace/api.server'
 *
 * When Marketplace is off, `runMarketplaceDoor` returns immediately (`reason: 'disabled'`).
 * Public browse / create / detail use this door; writes also gate through it in actions.
 */

import 'server-only'

export { MARKETPLACE_MODULE_ID } from './ids'
export { runMarketplaceDoor } from './door'
export type { MarketplaceDoorResult } from './door'
export {
  MARKETPLACE_LISTING_FEE_HOOK,
  ensureMarketplacePaymentHook,
  ensureMarketplacePaymentHookReady,
  startListingFeeCheckout,
} from './payment-bridge'
export type {
  StartListingFeeCheckoutInput,
  StartListingFeeCheckoutResult,
} from './payment-bridge'
