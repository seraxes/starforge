import 'server-only'

/**
 * product:payments public API (design-module-boundary §6).
 *
 *   import { createCart, addCartLine, startCheckout } from '@/modules/payments/api'
 *
 * Do not invent a second cart / gateway UI in consumer modules.
 */

export {
  CONSUMER_SOURCE_DOCS,
  getPaymentConsumerHook,
  registerPaymentConsumerHook,
  runPaymentConsumerHook,
} from './consumer-hooks'
export type { PaymentConsumerHook, PaymentConsumerHookContext } from './consumer-hooks'

export {
  addCartLine,
  applyProviderPaymentResult,
  createCart,
  getCartWithLines,
  getOrderGrossByIds,
  getOrderWithLines,
  getPaymentsSettings,
  listInvoices,
  listOrders,
  markOrderPaid,
  processFiscalOutboxItem,
  savePaymentsSettings,
  startCheckout,
  verifyAndCaptureOrder,
} from './store'
export type { OrderGrossSnapshot } from './store'

export {
  assertMayCollect,
  grantCollectCapability,
  hasCollectCapability,
} from './entitlement'

export {
  ensureMerchantForUser,
  getMerchantById,
  getMerchantByUserId,
  listMerchantCredentialsPublic,
  updateMerchantProfile,
  upsertMerchantCredential,
} from './merchant-store'
export type { CredentialPublic, MerchantRecord } from './merchant-store'

export { PAYMENT_SOURCE_TYPES } from './types'
export type {
  BuyerInfo,
  CartLineInput,
  MarkPaidInput,
  OrderStatus,
  PaymentsSettings,
  StartCheckoutInput,
  StartCheckoutResult,
} from './types'

export {
  formatMoneyMinor,
  majorToMinor,
  minorToMajor,
  computeMoneyLine,
  sumMoneyLines,
} from '@/core/payments'
