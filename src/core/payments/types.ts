/**
 * Payments infrastructure port — gateway + fiscal adapters.
 *
 * Product code uses `@/modules/payments/api` for cart/orders.
 * This port only talks to providers; secrets stay in env.
 */

export type PaymentMethodKind =
  | 'barion'
  | 'stripe'
  | 'paypal'
  | 'bank_transfer'
  | 'pay_at_entrance'
  | 'cash'

export type OnlinePaymentProvider = 'barion' | 'stripe' | 'paypal' | 'manual' | 'noop'

export const ONLINE_PAYMENT_PROVIDERS: Array<{
  value: OnlinePaymentProvider
  label: string
}> = [
  { value: 'noop', label: 'Noop (dev)' },
  { value: 'manual', label: 'Manual / offline only' },
  { value: 'barion', label: 'Barion' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
]

const ONLINE_SET = new Set<OnlinePaymentProvider>(
  ONLINE_PAYMENT_PROVIDERS.map((p) => p.value),
)

export function isOnlinePaymentProvider(value: unknown): value is OnlinePaymentProvider {
  return typeof value === 'string' && ONLINE_SET.has(value as OnlinePaymentProvider)
}

export const OFFLINE_PAYMENT_METHODS: PaymentMethodKind[] = [
  'bank_transfer',
  'pay_at_entrance',
  'cash',
]

export function isOfflinePaymentMethod(method: PaymentMethodKind): boolean {
  return OFFLINE_PAYMENT_METHODS.includes(method)
}

/** Integer minor units (fillér / cents). Never floats. */
export type MoneyMinor = number

export type VatCategory =
  | 'standard'
  | 'reduced'
  | 'zero'
  | 'exempt'
  | 'reverse_charge'

export type MoneyLineInput = {
  currency: string
  qty: number
  /** Unit amount as entered (gross or net per site setting). */
  unitAmountMinor: MoneyMinor
  vatRateBps: number
  vatCategory?: VatCategory
  /** When true, unitAmountMinor is gross; else net. */
  amountIsGross: boolean
}

export type MoneyLineComputed = {
  currency: string
  qty: number
  vatRateBps: number
  vatCategory: VatCategory
  unitNetMinor: MoneyMinor
  unitGrossMinor: MoneyMinor
  vatAmountMinor: MoneyMinor
  lineNetMinor: MoneyMinor
  lineGrossMinor: MoneyMinor
}

export type CreatePaymentIntentInput = {
  orderId: string
  idempotencyKey: string
  currency: string
  amountMinor: MoneyMinor
  description: string
  buyerEmail?: string
  returnUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export type CreatePaymentIntentResult = {
  ok: boolean
  provider: OnlinePaymentProvider
  /** Provider payment / session id. */
  providerRef?: string
  /** Redirect URL for hosted checkout (Barion / Stripe / PayPal). */
  redirectUrl?: string
  error?: string
}

export type PaymentIntentStatus =
  | 'pending'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type VerifyPaymentResult = {
  ok: boolean
  status: PaymentIntentStatus
  providerRef: string
  amountMinor?: MoneyMinor
  currency?: string
  raw?: unknown
  error?: string
}

export type RefundInput = {
  providerRef: string
  amountMinor: MoneyMinor
  currency: string
  reason?: string
}

export type RefundResult = {
  ok: boolean
  refundRef?: string
  error?: string
}

export type PaymentsProviderInfo = {
  provider: OnlinePaymentProvider
  label: string
  enabled: boolean
  ready: boolean
  detail?: string
}

export interface PaymentsProvider {
  createIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>
  /** Re-query provider state (IPN follow-up / return URL). Never trust browser amounts. */
  verifyIntent(providerRef: string): Promise<VerifyPaymentResult>
  refund?(input: RefundInput): Promise<RefundResult>
  /**
   * Verify webhook / IPN signature and parse provider refs.
   * Returns null when signature fails.
   */
  parseWebhook?(
    headers: Headers,
    rawBody: string,
  ): Promise<{ providerRef: string; status: PaymentIntentStatus } | null>
  info(): PaymentsProviderInfo
}

/** Optional per-merchant secrets (otherwise env). */
export type GatewayCredentials = {
  /** Barion POS key / Stripe secret / PayPal client secret, etc. */
  secret?: string
  /** Non-secret companion (Barion payee email, PayPal client id, API base). */
  publicId?: string
  apiBase?: string
  extra?: Record<string, string>
}

export type PaymentsFactoryOptions = {
  provider: OnlinePaymentProvider
  enabled: boolean
  credentials?: GatewayCredentials
}

/** Digital invoice API (Billingo / Számlázz.hu) — merchant own invoice. */
export type BillingProviderKind = 'noop' | 'billingo' | 'szamlazz'

export type BillingCredentials = {
  apiKey: string
  /** Számlázz agent key / Billingo block id extras */
  extra?: Record<string, string>
}

export type BillingSubmitResult = {
  ok: boolean
  externalId?: string
  skipped?: boolean
  error?: string
  pdfUrl?: string
}

export type BillingProviderInfo = {
  provider: BillingProviderKind
  label: string
  ready: boolean
  detail?: string
}

export interface BillingProvider {
  submitInvoice(payload: FiscalInvoicePayload): Promise<BillingSubmitResult>
  info(): BillingProviderInfo
}

/** Fiscal / NAV online számla port. */
export type FiscalInvoicePayload = {
  invoiceId: string
  invoiceNumber: string
  issueDate: string
  currency: string
  sellerVatId: string
  buyerVatId?: string
  buyerName: string
  lines: Array<{
    title: string
    qty: number
    unitNetMinor: MoneyMinor
    vatRateBps: number
    lineNetMinor: MoneyMinor
    lineGrossMinor: MoneyMinor
    vatCategory: VatCategory
  }>
  totalNetMinor: MoneyMinor
  totalVatMinor: MoneyMinor
  totalGrossMinor: MoneyMinor
}

export type FiscalSubmitResult = {
  ok: boolean
  fiscalRef?: string
  skipped?: boolean
  error?: string
}

export type FiscalProviderInfo = {
  provider: 'noop' | 'nav_online_szamla'
  label: string
  ready: boolean
  detail?: string
}

export interface FiscalProvider {
  submitInvoice(payload: FiscalInvoicePayload): Promise<FiscalSubmitResult>
  submitModifier?(
    originalInvoiceId: string,
    payload: FiscalInvoicePayload,
  ): Promise<FiscalSubmitResult>
  queryStatus?(fiscalRef: string): Promise<{ ok: boolean; status: string; error?: string }>
  info(): FiscalProviderInfo
}
