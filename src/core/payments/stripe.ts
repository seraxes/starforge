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
 * Stripe Checkout Session adapter.
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (for parseWebhook).
 */

function secretKey(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() || ''
}

function webhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || ''
}

function mapStripeStatus(status: string | undefined): PaymentIntentStatus {
  const s = (status || '').toLowerCase()
  if (s === 'complete' || s === 'paid' || s === 'succeeded') return 'succeeded'
  if (s === 'expired') return 'cancelled'
  if (s === 'open') return 'requires_action'
  return 'pending'
}

export function createStripePaymentsProvider(): PaymentsProvider {
  const key = secretKey()
  const ready = Boolean(key)

  return {
    async createIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
      if (!ready) {
        return { ok: false, provider: 'stripe', error: 'STRIPE_SECRET_KEY not configured' }
      }
      const params = new URLSearchParams()
      params.set('mode', 'payment')
      params.set('success_url', input.returnUrl)
      params.set('cancel_url', input.cancelUrl)
      params.set('client_reference_id', input.orderId)
      params.set('metadata[orderId]', input.orderId)
      params.set('metadata[idempotencyKey]', input.idempotencyKey)
      if (input.buyerEmail) params.set('customer_email', input.buyerEmail)
      params.set('line_items[0][quantity]', '1')
      params.set('line_items[0][price_data][currency]', input.currency.toLowerCase())
      params.set('line_items[0][price_data][unit_amount]', String(input.amountMinor))
      params.set('line_items[0][price_data][product_data][name]', input.description.slice(0, 200))

      try {
        const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Idempotency-Key': input.idempotencyKey.slice(0, 255),
          },
          body: params.toString(),
        })
        const data = (await res.json()) as {
          id?: string
          url?: string
          error?: { message?: string }
        }
        if (!res.ok || !data.id || !data.url) {
          return {
            ok: false,
            provider: 'stripe',
            error: data.error?.message || `Stripe HTTP ${res.status}`,
          }
        }
        return {
          ok: true,
          provider: 'stripe',
          providerRef: data.id,
          redirectUrl: data.url,
        }
      } catch (e) {
        return {
          ok: false,
          provider: 'stripe',
          error: e instanceof Error ? e.message : 'Stripe network error',
        }
      }
    },

    async verifyIntent(providerRef: string): Promise<VerifyPaymentResult> {
      if (!ready) {
        return {
          ok: false,
          status: 'failed',
          providerRef,
          error: 'STRIPE_SECRET_KEY not configured',
        }
      }
      try {
        const res = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(providerRef)}`,
          { headers: { Authorization: `Bearer ${key}` } },
        )
        const data = (await res.json()) as {
          id?: string
          status?: string
          payment_status?: string
          amount_total?: number
          currency?: string
        }
        if (!res.ok) {
          return {
            ok: false,
            status: 'failed',
            providerRef,
            error: `Stripe session HTTP ${res.status}`,
          }
        }
        const status = mapStripeStatus(
          data.payment_status === 'paid' ? 'succeeded' : data.status,
        )
        return {
          ok: status === 'succeeded',
          status,
          providerRef: data.id || providerRef,
          amountMinor: data.amount_total,
          currency: data.currency?.toUpperCase(),
          raw: data,
        }
      } catch (e) {
        return {
          ok: false,
          status: 'failed',
          providerRef,
          error: e instanceof Error ? e.message : 'Stripe verify error',
        }
      }
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      if (!ready) return { ok: false, error: 'STRIPE_SECRET_KEY not configured' }
      // Checkout session → need payment_intent; callers should pass PI when known.
      const params = new URLSearchParams()
      params.set('amount', String(input.amountMinor))
      if (input.providerRef.startsWith('pi_')) {
        params.set('payment_intent', input.providerRef)
      } else {
        return {
          ok: false,
          error: 'Stripe refund requires payment_intent id (pi_…); resolve from session first',
        }
      }
      try {
        const res = await fetch('https://api.stripe.com/v1/refunds', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        })
        const data = (await res.json()) as { id?: string; error?: { message?: string } }
        if (!res.ok) return { ok: false, error: data.error?.message || `Stripe refund HTTP ${res.status}` }
        return { ok: true, refundRef: data.id }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Stripe refund error' }
      }
    },

    async parseWebhook(
      headers: Headers,
      rawBody: string,
    ): Promise<{ providerRef: string; status: PaymentIntentStatus } | null> {
      const whSec = webhookSecret()
      if (!whSec) return null
      // Minimal HMAC check — Stripe-Signature header.
      const sig = headers.get('stripe-signature') || ''
      if (!sig) return null
      try {
        const crypto = await import('node:crypto')
        const parts = Object.fromEntries(
          sig.split(',').map((p) => {
            const [k, v] = p.split('=')
            return [k, v]
          }),
        )
        const timestamp = parts.t
        const v1 = parts.v1
        if (!timestamp || !v1) return null
        const signed = `${timestamp}.${rawBody}`
        const expected = crypto.createHmac('sha256', whSec).update(signed).digest('hex')
        const a = Buffer.from(expected, 'utf8')
        const b = Buffer.from(v1, 'utf8')
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
        const event = JSON.parse(rawBody) as {
          type?: string
          data?: { object?: { id?: string; payment_status?: string; status?: string } }
        }
        const obj = event.data?.object
        const providerRef = obj?.id || ''
        if (!providerRef) return null
        const status = mapStripeStatus(
          obj?.payment_status === 'paid' || event.type === 'checkout.session.completed'
            ? 'succeeded'
            : obj?.status,
        )
        return { providerRef, status }
      } catch {
        return null
      }
    },

    info(): PaymentsProviderInfo {
      return {
        provider: 'stripe',
        label: 'Stripe',
        enabled: true,
        ready,
        detail: ready
          ? webhookSecret()
            ? 'Secret key + webhook secret set'
            : 'Secret key set (webhook secret missing)'
          : 'Set STRIPE_SECRET_KEY in Environment',
      }
    },
  }
}
