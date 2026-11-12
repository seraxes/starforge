import 'server-only'

/**
 * product:subscriptions public API.
 *
 *   import { hasEntitlement, resolveAudience } from '@/modules/subscriptions/api'
 */

export {
  CHECKOUT_MODES,
  DEFAULT_SUBSCRIPTIONS_MODULE_SETTINGS,
  ENTITLEMENT_KEYS,
  LIFETIME_ENDS_AT,
  PLAN_SUBJECTS,
  PLAN_BILLING_PERIODS,
  defaultEntitlementKeysForSubject,
  isCheckoutMode,
  isPlanBillingPeriod,
} from './types'
export type {
  AudienceResolve,
  CheckoutMode,
  EntitlementKey,
  PeriodStatus,
  PlanBillingPeriod,
  PlanSubject,
  SubscriptionPeriodRecord,
  SubscriptionPlanRecord,
  SubscriptionSeatRecord,
  SubscriptionsModuleSettings,
} from './types'

export {
  loadSubscriptionsModuleSettings,
  saveSubscriptionsModuleSettings,
} from './settings'

export {
  activateFreePlan,
  activateOrExtendPeriod,
  addBillingPeriod,
  addSeat,
  adminCompPeriod,
  computeUpgradeCreditMajor,
  countActivePeriodsForPlan,
  countActiveSubscribers,
  createPlan,
  endPeriodsForOrder,
  expireLapsedPeriods,
  findPeriodById,
  findPlanById,
  hasActiveSubject,
  hasEntitlement,
  listActivePeriodsForUser,
  listPeriods,
  listPeriodsExpiringSoon,
  listPlans,
  listPlansByIds,
  listSeats,
  listTrialsEndingSoon,
  periodsToCsv,
  removeSeat,
  resolveAudience,
  resolveCheckoutPriceMajor,
  setCancelAtPeriodEnd,
  setPlanActive,
  updatePeriodWindow,
  updatePlan,
  userHasUsedTrial,
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
  SUBSCRIPTIONS_REMINDER_DAYS,
  ensureSubscriptionsExpiryJob,
  sweepExpiredSubscriptionPeriods,
} from './expiry'

export {
  DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID,
  ensureSubscriptionRegistrationFormSeeded,
  loadSubscriptionRegistrationFields,
} from './registration-form'

export {
  loadSubscriptionPlanLocaleMaps,
  persistSubscriptionPlanLocales,
} from './plan-locales'

export {
  ensureSubscriptionsEmailStartersSeeded,
  seedSubscriptionsEmailStarters,
} from './email-starters'

export {
  resyncUserSubscriptionGroups,
  syncGroupsOnActivate,
  syncGroupsOnPeriodEnd,
} from './group-sync'
