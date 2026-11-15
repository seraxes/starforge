import '@/core/payments/register-online'

import { getPaymentMethodAdapter, listOnlinePaymentMethodIds } from '@/core/payments/adapter'
import {
  offlineMerchantMethodReady,
  paymentMethodCredentialsReady,
} from '@/core/payments/credential-schema'
import {
  OFFLINE_PAYMENT_METHODS,
  isOfflinePaymentMethod,
  type PaymentMethodKind,
} from '@/core/payments/types'

/** Offline methods, then registered online adapters. Not a closed union. */
export function listMerchantPaymentMethods(): PaymentMethodKind[] {
  return [...OFFLINE_PAYMENT_METHODS, ...listOnlinePaymentMethodIds()]
}

export function isMerchantPaymentMethod(value: unknown): value is PaymentMethodKind {
  if (typeof value !== 'string' || !value.trim()) return false
  return isOfflinePaymentMethod(value) || Boolean(getPaymentMethodAdapter(value))
}

/** Checkout method ids a buyer may ask for (same set merchants can offer). */
export function isCheckoutPaymentMethod(value: unknown): value is PaymentMethodKind {
  return isMerchantPaymentMethod(value)
}

export function parseMerchantEnabledMethods(value: unknown): PaymentMethodKind[] {
  if (!Array.isArray(value)) return []
  const out: PaymentMethodKind[] = []
  for (const item of value) {
    if (isMerchantPaymentMethod(item) && !out.includes(item)) out.push(item)
  }
  return out
}

export type MerchantMethodProfile = {
  bankIban: string
  entranceInstructions: string
  cashInstructions: string
}

export type MerchantMethodCredential = {
  kind: string
  hasSecret: boolean
  meta?: Record<string, unknown>
}

/** Switch on is not enough — the block must contain what checkout needs. */
export function merchantMethodReady(
  method: PaymentMethodKind,
  profile: MerchantMethodProfile,
  credentials: MerchantMethodCredential[],
): boolean {
  const offline = offlineMerchantMethodReady(method, profile)
  if (offline !== null) return offline
  const adapter = getPaymentMethodAdapter(method)
  if (!adapter) return false
  return paymentMethodCredentialsReady(adapter, credentials)
}

export function offeredMerchantMethods(
  enabledMethods: PaymentMethodKind[],
  profile: MerchantMethodProfile,
  credentials: MerchantMethodCredential[],
): PaymentMethodKind[] {
  return enabledMethods.filter((method) => merchantMethodReady(method, profile, credentials))
}
