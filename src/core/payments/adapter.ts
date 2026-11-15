import { createManualPaymentsProvider } from './manual'
import { createNoopPaymentsProvider } from './noop'
import type {
  GatewayCredentials,
  OfflinePaymentMethod,
  PaymentsFactoryOptions,
  PaymentsProvider,
} from './types'
import { isOfflinePaymentMethod, OFFLINE_PAYMENT_METHODS } from './types'

export type PaymentCredentialInput = 'secret' | 'text' | 'email' | 'url'

/** One merchant-panel control and where its value is stored. */
export type PaymentCredentialField = {
  /** Form input name. Stable across saves. */
  name: string
  label: string
  input: PaymentCredentialInput
  /** Encrypted `sf_pay_merchant_credentials.kind` row. */
  kind: string
  /** `secret` → ciphertext. `meta` → plaintext meta on that row. */
  bind: 'secret' | 'meta'
  /** Meta key when `bind` is `meta`. */
  metaKey?: string
  /** Block is not offered until this saved value is present. */
  requiredForReady: boolean
  placeholder?: string
  spellCheck?: boolean
  /**
   * `panel` — masked-secret line on the offer hint.
   * `inline` — masked-secret line above this field (Stripe webhook).
   */
  savedHint?: 'panel' | 'inline'
  emptySavedHint?: string
}

export type PaymentCredentialKindRole = 'primary' | 'webhookSecret'

export type PaymentCredentialKind = {
  kind: string
  /**
   * `primary` — secret, publicId (`meta.publicId` or `meta.payeeEmail`), apiBase, extra meta.
   * `webhookSecret` — separate ciphertext mapped to `GatewayCredentials.extra.webhookSecret`.
   */
  role: PaymentCredentialKindRole
}

/**
 * Serializable online payment method. Safe to pass into client merchant panels.
 * `online: true` is the adapter class: hosted gateway, not an offline method.
 */
export type PaymentMethodDescriptor = {
  id: string
  label: string
  /** Buyer-facing checkout label. */
  buyerLabel: string
  online: true
  /** "Not offered until {missingReady}." */
  missingReady: string
  credentialSchema: {
    kinds: PaymentCredentialKind[]
    fields: PaymentCredentialField[]
  }
  /** Site webhook verify failed → try each merchant's keys (Stripe, PayPal). */
  webhookMerchantFallback: boolean
  /** GET on the webhook route peeks status and does not fulfill (Barion). */
  webhookGetStatusPeek: boolean
}

export type PaymentMethodAdapter = PaymentMethodDescriptor & {
  createProvider: (credentials?: GatewayCredentials) => PaymentsProvider
}

const SITE_PROVIDERS = new Set(['noop', 'manual'])

const adapters = new Map<string, PaymentMethodAdapter>()

export function registerPaymentMethodAdapter(adapter: PaymentMethodAdapter): void {
  const id = adapter.id.trim().toLowerCase()
  if (!id || SITE_PROVIDERS.has(id) || isOfflinePaymentMethod(id)) {
    throw new Error(`Payment adapter id "${adapter.id}" is reserved`)
  }
  if (adapter.online !== true) {
    throw new Error(`Payment adapter "${id}" must be an online gateway`)
  }
  const primary = adapter.credentialSchema.kinds.filter((kind) => kind.role === 'primary')
  if (primary.length !== 1) {
    throw new Error(`Payment adapter "${id}" needs exactly one primary credential kind`)
  }
  adapters.set(id, { ...adapter, id })
}

export function getPaymentMethodAdapter(id: string): PaymentMethodAdapter | undefined {
  return adapters.get(id.trim().toLowerCase())
}

export function listPaymentMethodAdapters(): PaymentMethodAdapter[] {
  return [...adapters.values()]
}

/** Descriptors only — no `createProvider`. Safe as a client component prop. */
export function listPaymentMethodDescriptors(): PaymentMethodDescriptor[] {
  return listPaymentMethodAdapters().map((adapter) => {
    const { createProvider: _createProvider, ...descriptor } = adapter
    return descriptor
  })
}

export function listOnlinePaymentMethodIds(): string[] {
  return listPaymentMethodAdapters().map((adapter) => adapter.id)
}

export function isOnlinePaymentProvider(value: unknown): value is string {
  return typeof value === 'string' && (SITE_PROVIDERS.has(value) || adapters.has(value))
}

const OFFLINE_LABELS: Record<OfflinePaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  pay_at_entrance: 'Pay at entrance',
  cash: 'Cash',
}

/** Site MoR method checklist: fixed offline methods, then registered gateways. */
export function listCheckoutPaymentMethods(): Array<{ value: string; label: string }> {
  return [
    ...OFFLINE_PAYMENT_METHODS.map((value) => ({ value, label: OFFLINE_LABELS[value] })),
    ...listPaymentMethodDescriptors().map((descriptor) => ({
      value: descriptor.id,
      label: descriptor.label,
    })),
  ]
}

/** Site/dev provider picker: noop, manual, then registered gateways. */
export function listOnlinePaymentProviders(): Array<{ value: string; label: string }> {
  return [
    { value: 'noop', label: 'Noop (dev)' },
    { value: 'manual', label: 'Manual / offline only' },
    ...listPaymentMethodDescriptors().map((descriptor) => ({
      value: descriptor.id,
      label: descriptor.label,
    })),
  ]
}

/** Environment editor choices for `SF_PAYMENTS_PROVIDER`. */
export function paymentsProviderEnvOptions(): Array<{ value: string; label: string }> {
  return [{ value: '', label: '(unset — manual)' }, ...listOnlinePaymentProviders()]
}

export function checkoutPaymentMethodLabel(method: string): string {
  if (isOfflinePaymentMethod(method)) return OFFLINE_LABELS[method]
  return getPaymentMethodAdapter(method)?.buyerLabel || method
}

export function paymentMethodCredentialKinds(methodId: string): {
  primary: string
  webhookSecret?: string
} {
  const adapter = getPaymentMethodAdapter(methodId)
  const kinds = adapter?.credentialSchema.kinds ?? []
  const primary = kinds.find((kind) => kind.role === 'primary')?.kind || methodId
  const webhookSecret = kinds.find((kind) => kind.role === 'webhookSecret')?.kind
  return webhookSecret ? { primary, webhookSecret } : { primary }
}

/**
 * Build a PaymentsProvider from explicit options (tests / merchant credentials).
 * Online ids resolve through the registry. `manual` and `noop` stay site/dev providers.
 */
export function createPaymentsProvider(options: PaymentsFactoryOptions): PaymentsProvider {
  if (!options.enabled) return createNoopPaymentsProvider()
  if (options.provider === 'manual') return createManualPaymentsProvider()
  const adapter = adapters.get(options.provider)
  if (adapter) return adapter.createProvider(options.credentials)
  return createNoopPaymentsProvider()
}

export function getPaymentsProvider(
  override?: string,
  credentials?: GatewayCredentials,
): PaymentsProvider {
  const raw = (override || process.env.SF_PAYMENTS_PROVIDER || 'manual').trim() || 'manual'
  const provider = isOnlinePaymentProvider(raw) ? raw : 'manual'
  return createPaymentsProvider({ provider, enabled: true, credentials })
}

export function getPaymentsProviderForMethod(
  method: string,
  credentials?: GatewayCredentials,
): PaymentsProvider {
  if (getPaymentMethodAdapter(method)) return getPaymentsProvider(method, credentials)
  return createManualPaymentsProvider()
}
