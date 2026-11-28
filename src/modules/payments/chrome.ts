import 'server-only'

import { getTranslations } from 'next-intl/server'

import { checkoutPaymentMethodLabel } from '@/core/payments'

/** next-intl namespace for product:payments chrome (messages/en.json + hu.json). */
export const PAYMENTS_I18N_NAMESPACE = 'product:payments' as const

/** Member-facing coupon error keys (same ids as messages/*.json). */
export const COUPON_CHROME_ERRORS = {
  required: 'couponCodeRequired',
  invalid: 'couponInvalid',
  usageLimit: 'couponUsageLimit',
  currencyMismatch: 'couponCurrencyMismatch',
  doesNotApply: 'couponDoesNotApply',
  discountZero: 'couponDiscountZero',
} as const

const METHOD_CHROME_KEYS: Record<string, string> = {
  bank_transfer: 'methodBankTransfer',
  pay_at_entrance: 'methodPayAtEntrance',
  cash: 'methodCash',
  barion: 'methodBarion',
  stripe: 'methodStripe',
  paypal: 'methodPayPal',
}

type PaymentsChromeValues = Record<string, string | number | Date>

export async function translatePaymentsChrome(
  key: string,
  values?: PaymentsChromeValues,
): Promise<string> {
  const t = await getTranslations(PAYMENTS_I18N_NAMESPACE)
  return values ? t(key, values) : t(key)
}

const LOCALIZABLE_ERROR_KEYS = new Set<string>([
  ...Object.values(COUPON_CHROME_ERRORS),
  'merchantUnavailable',
  'methodNotOffered',
  'methodNotEnabled',
  'cartNotFound',
  'cartEmpty',
  'merchantCredentialsMissing',
  'providerCreateFailed',
])

/** Localize a known chrome key; leave unknown/admin strings unchanged. */
export async function localizePaymentsChromeError(
  error: string,
  values?: PaymentsChromeValues,
): Promise<string> {
  const key = error.trim()
  if (!LOCALIZABLE_ERROR_KEYS.has(key)) return error
  return translatePaymentsChrome(key, values)
}

export async function paymentMethodChromeLabel(method: string): Promise<string> {
  const key = METHOD_CHROME_KEYS[method]
  if (!key) return checkoutPaymentMethodLabel(method)
  try {
    return await translatePaymentsChrome(key)
  } catch {
    return checkoutPaymentMethodLabel(method)
  }
}

export function orderStatusChromeKey(status: string): string | null {
  if (status === 'expired') return 'statusExpired'
  if (status === 'failed') return 'statusFailed'
  if (status === 'refunded') return 'statusRefunded'
  return null
}
