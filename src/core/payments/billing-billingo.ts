import 'server-only'

import type {
  BillingCredentials,
  BillingProvider,
  BillingProviderInfo,
  BillingSubmitResult,
  FiscalInvoicePayload,
} from './types'
import { currencyExponent } from './money'

/**
 * Billingo v3 invoice bridge — merchant API key.
 * Docs: https://billingo.readthedocs.io / api.billingo.hu
 */

function apiBase(): string {
  return (process.env.BILLINGO_API_BASE?.trim() || 'https://api.billingo.hu/v3').replace(
    /\/$/,
    '',
  )
}

export function createBillingoBillingProvider(
  credentials: BillingCredentials,
): BillingProvider {
  const key = credentials.apiKey.trim()
  const ready = Boolean(key)
  const blockId = Number(credentials.extra?.blockId || 0) || undefined

  return {
    async submitInvoice(payload: FiscalInvoicePayload): Promise<BillingSubmitResult> {
      if (!ready) return { ok: false, error: 'Billingo API key missing' }
      const exp = currencyExponent(payload.currency)
      const toMajor = (minor: number) => Number((minor / 10 ** exp).toFixed(exp))

      try {
        const res = await fetch(`${apiBase()}/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': key,
          },
          body: JSON.stringify({
            type: 'invoice',
            fulfillment_date: payload.issueDate,
            due_date: payload.issueDate,
            payment_status: 'paid',
            payment_method: 'online_bankcard',
            language: payload.currency.toUpperCase() === 'HUF' ? 'hu' : 'en',
            currency: payload.currency.toUpperCase(),
            block_id: blockId,
            partner: {
              name: payload.buyerName,
              taxcode: payload.buyerVatId || undefined,
            },
            items: payload.lines.map((l) => ({
              name: l.title.slice(0, 255),
              unit_price: toMajor(l.unitNetMinor),
              unit_price_type: 'net',
              quantity: l.qty,
              unit: 'db',
              vat: String(Math.round(l.vatRateBps / 100)),
            })),
            comment: `SF ${payload.invoiceNumber}`,
          }),
        })
        const data = (await res.json()) as { id?: number | string; message?: string }
        if (!res.ok) {
          return { ok: false, error: data.message || `Billingo HTTP ${res.status}` }
        }
        return { ok: true, externalId: String(data.id ?? '') }
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'Billingo network error',
        }
      }
    },
    info(): BillingProviderInfo {
      return {
        provider: 'billingo',
        label: 'Billingo',
        ready,
        detail: ready ? `API ${apiBase()}` : 'Merchant Billingo API key required',
      }
    },
  }
}
