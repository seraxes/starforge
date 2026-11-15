import 'server-only'

import './register-online'
import { createBillingoBillingProvider } from './billing-billingo'
import { createNoopBillingProvider } from './billing-noop'
import { createSzamlazzBillingProvider } from './billing-szamlazz'
import { createNavFiscalProvider } from './fiscal-nav'
import { createNoopFiscalProvider } from './fiscal-noop'
import type {
  BillingCredentials,
  BillingProvider,
  BillingProviderKind,
  FiscalProvider,
} from './types'

export {
  checkoutPaymentMethodLabel,
  createPaymentsProvider,
  getPaymentMethodAdapter,
  getPaymentsProvider,
  getPaymentsProviderForMethod,
  isOnlinePaymentProvider,
  listCheckoutPaymentMethods,
  listOnlinePaymentMethodIds,
  listOnlinePaymentProviders,
  listPaymentMethodAdapters,
  listPaymentMethodDescriptors,
  paymentMethodCredentialKinds,
  paymentsProviderEnvOptions,
  registerPaymentMethodAdapter,
} from './adapter'
export type {
  PaymentCredentialField,
  PaymentCredentialKind,
  PaymentMethodAdapter,
  PaymentMethodDescriptor,
} from './adapter'
export {
  credentialWritesFromForm,
  offlineMerchantMethodReady,
  paymentMethodCredentialsReady,
} from './credential-schema'
export type { MerchantCredentialWrite } from './credential-schema'

export {
  OFFLINE_PAYMENT_METHODS,
  isOfflinePaymentMethod,
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
