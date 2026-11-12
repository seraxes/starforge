import 'server-only'

/**
 * product:subscriptions public API.
 *
 *   import { hasEntitlement, resolveAudience } from '@/modules/subscriptions/api'
 */

export {
  ENTITLEMENT_KEYS,
  PLAN_SUBJECTS,
  PLAN_BILLING_PERIODS,
  defaultEntitlementKeysForSubject,
  isPlanBillingPeriod,
} from './types'
export type {
  AudienceResolve,
  EntitlementKey,
  PeriodStatus,
  PlanBillingPeriod,
  PlanSubject,
  SubscriptionPeriodRecord,
  SubscriptionPlanRecord,
} from './types'

export {
  activateOrExtendPeriod,
  addBillingPeriod,
  adminCompPeriod,
  countActiveSubscribers,
  createPlan,
  endPeriodsForOrder,
  expireLapsedPeriods,
  findPlanById,
  hasActiveSubject,
  hasEntitlement,
  listActivePeriodsForUser,
  listPeriods,
  listPlans,
  listPlansByIds,
  resolveAudience,
  setPlanActive,
  updatePlan,
} from './store'

export {
  SUBSCRIPTIONS_PAYMENT_HOOK,
  ensureSubscriptionsPaymentHook,
  ensureSubscriptionsPaymentHookReady,
  startSubscriptionCheckout,
} from './payment-bridge'
export type {
  StartSubscriptionCheckoutInput,
  StartSubscriptionCheckoutResult,
} from './payment-bridge'

export {
  SUBSCRIPTIONS_EXPIRY_JOB,
  ensureSubscriptionsExpiryJob,
  sweepExpiredSubscriptionPeriods,
} from './expiry'
