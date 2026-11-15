import { NextResponse } from 'next/server'

import { getPaymentMethodAdapter, getPaymentsProviderForMethod } from '@/core/payments'
import {
  applyProviderPaymentResult,
  resolveProviderForProviderRef,
} from '@/modules/payments/api'
import { listMerchantGatewayCredentials } from '@/modules/payments/merchant-store'

export const runtime = 'nodejs'

/**
 * Provider webhooks / IPN — signature verify via PaymentsProvider.parseWebhook,
 * then re-verify with merchant or site credentials + amount check.
 * Unknown ids 404. Adapters without parseWebhook 501.
 * Merchant-key fallback runs only when the adapter asks for it.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params
  const provider = raw.trim().toLowerCase()
  const registered = getPaymentMethodAdapter(provider)
  if (!registered) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  const rawBody = await request.text()
  const siteAdapter = getPaymentsProviderForMethod(provider)
  if (!siteAdapter.parseWebhook) {
    return NextResponse.json({ error: 'Webhook not supported' }, { status: 501 })
  }

  let parsed = await siteAdapter.parseWebhook(request.headers, rawBody)
  if (!parsed && registered.webhookMerchantFallback) {
    const sets = await listMerchantGatewayCredentials(provider)
    for (const credentials of sets) {
      const adapter = getPaymentsProviderForMethod(provider, credentials)
      const hit = await adapter.parseWebhook?.(request.headers, rawBody)
      if (hit) {
        parsed = hit
        break
      }
    }
  }
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
 * Browser return may hit GET with PaymentId — verify only, do not fulfill.
 * Only adapters that set webhookGetStatusPeek (Barion) accept GET.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params
  const provider = raw.trim().toLowerCase()
  const registered = getPaymentMethodAdapter(provider)
  if (!registered?.webhookGetStatusPeek) {
    return NextResponse.json({ error: 'GET only for status peek' }, { status: 405 })
  }

  const url = new URL(request.url)
  const paymentId = url.searchParams.get('PaymentId') || url.searchParams.get('paymentId')
  if (!paymentId) {
    return NextResponse.json({ error: 'Missing PaymentId' }, { status: 400 })
  }

  const { provider: adapter } = await resolveProviderForProviderRef(paymentId, provider)
  const verified = await adapter.verifyIntent(paymentId)
  return NextResponse.json({
    ok: true,
    status: verified.status,
    fulfilled: false,
    note: 'GET does not capture — wait for IPN POST',
  })
}
