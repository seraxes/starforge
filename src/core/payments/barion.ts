import 'server-only'

import type {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentIntentStatus,
  PaymentsProvider,
  PaymentsProviderInfo,
  RefundInput,
  RefundResult,
  VerifyPaymentResult,
} from './types'

/**
 * Barion adapter — PreparePayment (v2) + GetPaymentState (v4).
 * Never trust browser-posted amounts; always re-query PaymentState.
 *
 * Env: BARION_POS_KEY, BARION_API_BASE (optional; default test API),
 * BARION_PAYEE_EMAIL (optional).
 */

function barionApiBase(): string {
  return (
    process.env.BARION_API_BASE?.trim() ||
    'https://api.test.barion.com'
  ).replace(/\/$/, '')
}

function posKey(override?: string): string {
  return (override || process.env.BARION_POS_KEY || '').trim()
}

function mapBarionStatus(status: string | undefined): PaymentIntentStatus {
  const s = (status || '').toLowerCase()
  if (s === 'succeeded' || s === 'finished' || s === 'completed') return 'succeeded'
  if (s === 'failed' || s === 'expired' || s === 'canceled' || s === 'cancelled') {
    return s.includes('cancel') ? 'cancelled' : 'failed'
  }
  if (s === 'prepared' || s === 'started' || s === 'inprogress' || s === 'waiting') {
    return 'requires_action'
  }
  return 'pending'
}

export function createBarionPaymentsProvider(credentials?: {
  secret?: string
  publicId?: string
  apiBase?: string
}): PaymentsProvider {
  const key = posKey(credentials?.secret)
  const payee =
    credentials?.publicId?.trim() || process.env.BARION_PAYEE_EMAIL?.trim() || undefined
  const apiBase = (credentials?.apiBase || barionApiBase()).replace(/\/$/, '')
  const ready = Boolean(key)

  return {
    async createIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
      if (!ready) {
        return { ok: false, provider: 'barion', error: 'BARION_POS_KEY not configured' }
      }

      const currency = input.currency.toUpperCase()
      const body = {
        POSKey: key,
        PaymentType: 'Immediate',
        GuestCheckout: true,
        FundingSources: ['All'],
        PaymentRequestId: input.idempotencyKey.slice(0, 100),
        OrderNumber: input.orderId.slice(0, 100),
        Currency: currency,
        RedirectUrl: input.returnUrl,
        CallbackUrl: input.metadata?.callbackUrl || undefined,
        Locale: currency === 'HUF' ? 'hu-HU' : 'en-US',
        Transactions: [
          {
            POSTransactionId: input.orderId.slice(0, 100),
            Payee: payee,
            Total: input.amountMinor,
            Comment: input.description.slice(0, 640),
            Items: [
              {
                Name: input.description.slice(0, 250),
                Description: input.description.slice(0, 500),
                Quantity: 1,
                Unit: 'piece',
                UnitPrice: input.amountMinor,
                ItemTotal: input.amountMinor,
              },
            ],
          },
        ],
      }

      try {
        const res = await fetch(`${apiBase}/v2/Payment/Start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as {
          PaymentId?: string
          GatewayUrl?: string
          Errors?: Array<{ Title?: string; Description?: string }>
        }
        if (!res.ok || !data.PaymentId || !data.GatewayUrl) {
          const err =
            data.Errors?.map((e) => e.Description || e.Title).filter(Boolean).join('; ') ||
            `Barion Start HTTP ${res.status}`
          return { ok: false, provider: 'barion', error: err }
        }
        return {
          ok: true,
          provider: 'barion',
          providerRef: data.PaymentId,
          redirectUrl: data.GatewayUrl,
        }
      } catch (e) {
        return {
          ok: false,
          provider: 'barion',
          error: e instanceof Error ? e.message : 'Barion network error',
        }
      }
    },

    async verifyIntent(providerRef: string): Promise<VerifyPaymentResult> {
      if (!ready) {
        return {
          ok: false,
          status: 'failed',
          providerRef,
          error: 'BARION_POS_KEY not configured',
        }
      }
      try {
        const url = new URL(`${apiBase}/v4/Payment/${encodeURIComponent(providerRef)}/PaymentState`)
        // v4 PaymentState often uses POSKey query; also support classic GetPaymentState
        url.searchParams.set('POSKey', key)
        let res = await fetch(url.toString(), { method: 'GET' })
        if (!res.ok) {
          const legacy = new URL(`${apiBase}/v2/Payment/GetPaymentState`)
          legacy.searchParams.set('POSKey', key)
          legacy.searchParams.set('PaymentId', providerRef)
          res = await fetch(legacy.toString(), { method: 'GET' })
        }
        const data = (await res.json()) as {
          Status?: string
          Total?: number
          Currency?: string
          PaymentId?: string
          Errors?: unknown
        }
        if (!res.ok) {
          return {
            ok: false,
            status: 'failed',
            providerRef,
            error: `Barion PaymentState HTTP ${res.status}`,
            raw: data,
          }
        }
        const status = mapBarionStatus(data.Status)
        return {
          ok: status === 'succeeded',
          status,
          providerRef: data.PaymentId || providerRef,
          amountMinor: typeof data.Total === 'number' ? data.Total : undefined,
          currency: data.Currency,
          raw: data,
        }
      } catch (e) {
        return {
          ok: false,
          status: 'failed',
          providerRef,
          error: e instanceof Error ? e.message : 'Barion verify error',
        }
      }
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      if (!ready) return { ok: false, error: 'BARION_POS_KEY not configured' }
      try {
        const res = await fetch(`${apiBase}/v2/Payment/Refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            POSKey: key,
            PaymentId: input.providerRef,
            TransactionsToRefund: [
              {
                TransactionId: input.providerRef,
                AmountToRefund: input.amountMinor,
                Comment: input.reason?.slice(0, 640) || 'Refund',
              },
            ],
          }),
        })
        const data = (await res.json()) as { RefundId?: string; Errors?: unknown }
        if (!res.ok) {
          return { ok: false, error: `Barion Refund HTTP ${res.status}` }
        }
        return { ok: true, refundRef: data.RefundId || `barion_refund_${Date.now()}` }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Barion refund error' }
      }
    },

    async parseWebhook(
      _headers: Headers,
      rawBody: string,
    ): Promise<{ providerRef: string; status: PaymentIntentStatus } | null> {
      // Barion IPN posts PaymentId; always re-verify via PaymentState.
      try {
        const parsed = JSON.parse(rawBody) as { PaymentId?: string; paymentId?: string }
        const providerRef = (parsed.PaymentId || parsed.paymentId || '').trim()
        if (!providerRef) return null
        const verified = await this.verifyIntent(providerRef)
        return { providerRef, status: verified.status }
      } catch {
        // form-urlencoded PaymentId=
        const params = new URLSearchParams(rawBody)
        const providerRef = (params.get('PaymentId') || params.get('paymentId') || '').trim()
        if (!providerRef) return null
        const verified = await this.verifyIntent(providerRef)
        return { providerRef, status: verified.status }
      }
    },

    info(): PaymentsProviderInfo {
      return {
        provider: 'barion',
        label: 'Barion',
        enabled: true,
        ready,
        detail: ready ? `API ${apiBase}` : 'Set BARION_POS_KEY in Environment',
      }
    },
  }
}
