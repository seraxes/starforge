import 'server-only'

import { createBarionPaymentsProvider } from './barion'
import { createBillingoBillingProvider } from './billing-billingo'
import { createNoopBillingProvider } from './billing-noop'
import { createSzamlazzBillingProvider } from './billing-szamlazz'
import { createNavFiscalProvider } from './fiscal-nav'
import { createNoopFiscalProvider } from './fiscal-noop'
import { createManualPaymentsProvider } from './manual'
import { createNoopPaymentsProvider } from './noop'
import { createPayPalPaymentsProvider } from './paypal'
import { createStripePaymentsProvider } from './stripe'
import type {
  BillingCredentials,
  BillingProvider,
  BillingProviderKind,
  FiscalProvider,
  GatewayCredentials,
  OnlinePaymentProvider,
  PaymentsFactoryOptions,
  PaymentsProvider,
} from './types'
import { isOnlinePaymentProvider } from './types'

export {
  OFFLINE_PAYMENT_METHODS,
  ONLINE_PAYMENT_PROVIDERS,
  isOfflinePaymentMethod,
  isOnlinePaymentProvider,
} from './types'
export type {
  BillingCredentials,
  BillingProvider,
  BillingProviderInfo,
  BillingProviderKind,
  BillingSubmitResult,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  FiscalInvoicePayload,
  FiscalProvider,
  FiscalProviderInfo,
  FiscalSubmitResult,
  GatewayCredentials,
  MoneyLineComputed,
  MoneyLineInput,
  MoneyMinor,
  OnlinePaymentProvider,
  PaymentIntentStatus,
  PaymentMethodKind,
  PaymentsFactoryOptions,
  PaymentsProvider,
  PaymentsProviderInfo,
  RefundInput,
  RefundResult,
  VatCategory,
  VerifyPaymentResult,
} from './types'

export {
  computeMoneyLine,
  currencyExponent,
  formatMoneyMinor,
  majorToMinor,
  minorToMajor,
  sumMoneyLines,
} from './money'

/**
 * Build a PaymentsProvider from explicit options (tests / merchant credentials).
 */
export function createPaymentsProvider(options: PaymentsFactoryOptions): PaymentsProvider {
  if (!options.enabled) {
    return createNoopPaymentsProvider()
  }
  const creds = options.credentials
  switch (options.provider) {
    case 'barion':
      return createBarionPaymentsProvider(creds)
    case 'stripe':
      return createStripePaymentsProvider()
    case 'paypal':
      return createPayPalPaymentsProvider()
    case 'manual':
      return createManualPaymentsProvider()
    case 'noop':
    default:
      return createNoopPaymentsProvider()
  }
}

export function getPaymentsProvider(
  override?: OnlinePaymentProvider,
  credentials?: GatewayCredentials,
): PaymentsProvider {
  const raw = override || process.env.SF_PAYMENTS_PROVIDER?.trim() || 'manual'
  const provider: OnlinePaymentProvider = isOnlinePaymentProvider(raw) ? raw : 'manual'
  return createPaymentsProvider({ provider, enabled: true, credentials })
}

export function getPaymentsProviderForMethod(
  method: string,
  credentials?: GatewayCredentials,
): PaymentsProvider {
  if (method === 'barion' || method === 'stripe' || method === 'paypal') {
    return getPaymentsProvider(method, credentials)
  }
  return createManualPaymentsProvider()
}

export type FiscalFactoryOptions = {
  provider: 'noop' | 'nav_online_szamla'
}

export function createFiscalProvider(options: FiscalFactoryOptions): FiscalProvider {
  if (options.provider === 'nav_online_szamla') {
    return createNavFiscalProvider()
  }
  return createNoopFiscalProvider()
}

export function getFiscalProvider(): FiscalProvider {
  const raw = process.env.SF_FISCAL_PROVIDER?.trim() || 'noop'
  if (raw === 'nav_online_szamla' || raw === 'nav') {
    return createNavFiscalProvider()
  }
  return createNoopFiscalProvider()
}

export function createBillingProvider(
  kind: BillingProviderKind,
  credentials?: BillingCredentials,
): BillingProvider {
  if (kind === 'billingo' && credentials?.apiKey) {
    return createBillingoBillingProvider(credentials)
  }
  if (kind === 'szamlazz' && credentials?.apiKey) {
    return createSzamlazzBillingProvider(credentials)
  }
  return createNoopBillingProvider()
}
