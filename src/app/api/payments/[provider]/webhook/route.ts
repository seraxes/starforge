import { NextResponse } from 'next/server'

import { getPaymentsProviderForMethod } from '@/core/payments'
import type { PaymentMethodKind } from '@/core/payments'
import {
  applyProviderPaymentResult,
  resolveProviderForProviderRef,
} from '@/modules/payments/store'

export const runtime = 'nodejs'

const ONLINE = new Set(['barion', 'stripe', 'paypal'])

/**
 * Provider webhooks / IPN — signature verify via PaymentsProvider.parseWebhook,
 * then re-verify with merchant or site credentials + amount check.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params
  const provider = raw.trim().toLowerCase()
  if (!ONLINE.has(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  const rawBody = await request.text()
  // Initial parse with site adapter (Stripe HMAC / PayPal verify / Barion PaymentId extract).
  const siteAdapter = getPaymentsProviderForMethod(provider as PaymentMethodKind)
  if (!siteAdapter.parseWebhook) {
    return NextResponse.json({ error: 'Webhook not supported' }, { status: 501 })
  }

  const parsed = await siteAdapter.parseWebhook(request.headers, rawBody)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid signature or payload' }, { status: 401 })
  }

  const { provider: adapter } = await resolveProviderForProviderRef(
    parsed.providerRef,
    provider,
  )
  const verified = await adapter.verifyIntent(parsed.providerRef)
  const status =
    verified.status === 'succeeded'
      ? 'succeeded'
      : verified.status === 'failed'
        ? 'failed'
        : verified.status === 'cancelled'
          ? 'cancelled'
          : 'pending'

  if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    const result = await applyProviderPaymentResult({
      providerRef: parsed.providerRef,
      status,
      amountMinor: verified.amountMinor,
      currency: verified.currency,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Apply failed' }, { status: 422 })
    }
    return NextResponse.json({ ok: true, orderId: result.orderId, status })
  }

  return NextResponse.json({ ok: true, status: 'ignored', providerStatus: verified.status })
}

/**
 * Barion browser return may hit GET with PaymentId — verify only, do not fulfill.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params
  const provider = raw.trim().toLowerCase()
  if (provider !== 'barion') {
    return NextResponse.json({ error: 'GET only for Barion status peek' }, { status: 405 })
  }

  const url = new URL(request.url)
  const paymentId = url.searchParams.get('PaymentId') || url.searchParams.get('paymentId')
  if (!paymentId) {
    return NextResponse.json({ error: 'Missing PaymentId' }, { status: 400 })
  }

  const { provider: adapter } = await resolveProviderForProviderRef(paymentId, 'barion')
  const verified = await adapter.verifyIntent(paymentId)
  return NextResponse.json({
    ok: true,
    status: verified.status,
    fulfilled: false,
    note: 'GET does not capture — wait for IPN POST',
  })
}
