import type { PaymentMethodKind, VatCategory } from '@/core/payments/types'

export type OrderStatus =
  | 'draft_cart'
  | 'checkout_pending'
  | 'awaiting_offline'
  | 'redirected_provider'
  | 'paid'
  | 'fulfilled'
  | 'expired'
  | 'failed'
  | 'refunded'

export type CartLineInput = {
  sourceModule: string
  sourceType: string
  sourceId: string
  title: string
  qty?: number
  /** Unit amount in minor units (interpreted as gross/net per settings). */
  unitAmountMinor: number
  vatRateBps?: number
  vatCategory?: VatCategory
  billingPeriod?: string | null
  metadata?: Record<string, unknown>
}

export type BuyerInfo = {
  email: string
  name?: string
  userId?: string | null
  vatId?: string
  isCompany?: boolean
}

export type StartCheckoutInput = {
  cartId: string
  method: PaymentMethodKind
  buyer: BuyerInfo
  idempotencyKey: string
  returnUrl: string
  cancelUrl: string
  /** Optional consumer fulfillment key e.g. events.confirmRegistration */
  consumerHook?: string
  /** Premium merchant collect — null/omit = site MoR */
  merchantId?: string | null
  metadata?: Record<string, unknown>
}

export type StartCheckoutResult =
  | {
      ok: true
      orderId: string
      status: OrderStatus
      redirectUrl?: string
      paymentReference?: string
    }
  | { ok: false; error: string }

export type MarkPaidInput = {
  orderId: string
  staffUserId: string
  reason: string
}

/** Known consumer source contracts (documentation + runtime allowlist helpers). */
export const PAYMENT_SOURCE_TYPES = {
  eventsTicketTier: { sourceModule: 'product:events', sourceType: 'ticket_tier' },
  shopSku: { sourceModule: 'product:shop', sourceType: 'sku' },
  marketplaceListing: { sourceModule: 'product:marketplace', sourceType: 'listing' },
  subscriptionsPlan: { sourceModule: 'product:subscriptions', sourceType: 'plan' },
  adsCampaignCredit: { sourceModule: 'product:ads', sourceType: 'campaign_credit' },
} as const

export type PaymentsSettings = {
  currency: string
  amountEntryMode: 'gross' | 'net'
  defaultVatRateBps: number
  taxCountry: string
  enabledMethods: PaymentMethodKind[]
  sellerName: string
  sellerAddress: string
  sellerVatId: string
  bankIban: string
  bankName: string
  bankAccountName: string
  entranceInstructions: string
  cashInstructions: string
  invoiceSeriesPrefix: string
  checkoutTtlMinutes: number
}
