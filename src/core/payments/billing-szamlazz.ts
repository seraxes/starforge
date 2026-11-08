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
 * Számlázz.hu agent XML bridge — merchant agent key.
 * Endpoint: https://www.szamlazz.hu/szamla/
 */

function endpoint(): string {
  return (
    process.env.SZAMLAZZ_API_URL?.trim() || 'https://www.szamlazz.hu/szamla/'
  ).replace(/\/?$/, '/')
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function createSzamlazzBillingProvider(
  credentials: BillingCredentials,
): BillingProvider {
  const agentKey = credentials.apiKey.trim()
  const ready = Boolean(agentKey)

  return {
    async submitInvoice(payload: FiscalInvoicePayload): Promise<BillingSubmitResult> {
      if (!ready) return { ok: false, error: 'Számlázz.hu agent key missing' }
      const exp = currencyExponent(payload.currency)
      const toMajor = (minor: number) => (minor / 10 ** exp).toFixed(exp)

      const itemsXml = payload.lines
        .map(
          (l) => `<tetel>
  <megnevezes>${escapeXml(l.title.slice(0, 200))}</megnevezes>
  <mennyiseg>${l.qty}</mennyiseg>
  <mennyisegiEgyseg>db</mennyisegiEgyseg>
  <nettoEgysegar>${toMajor(l.unitNetMinor)}</nettoEgysegar>
  <afakulcs>${Math.round(l.vatRateBps / 100)}</afakulcs>
  <nettoErtek>${toMajor(l.lineNetMinor)}</nettoErtek>
  <afaErtek>${toMajor(l.lineGrossMinor - l.lineNetMinor)}</afaErtek>
  <bruttoErtek>${toMajor(l.lineGrossMinor)}</bruttoErtek>
</tetel>`,
        )
        .join('\n')

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
  </beallitasok>
  <fejlec>
    <keltDatum>${escapeXml(payload.issueDate)}</keltDatum>
    <teljesitesDatum>${escapeXml(payload.issueDate)}</teljesitesDatum>
    <fizetesiHataridoDatum>${escapeXml(payload.issueDate)}</fizetesiHataridoDatum>
    <fizmod>Bankkártya</fizmod>
    <penznem>${escapeXml(payload.currency.toUpperCase())}</penznem>
    <szamlaNyelve>${payload.currency.toUpperCase() === 'HUF' ? 'hu' : 'en'}</szamlaNyelve>
    <megjegyzes>${escapeXml(payload.invoiceNumber)}</megjegyzes>
  </fejlec>
  <vevo>
    <nev>${escapeXml(payload.buyerName)}</nev>
    <adoszam>${escapeXml(payload.buyerVatId || '')}</adoszam>
  </vevo>
  <tetelek>
${itemsXml}
  </tetelek>
</xmlszamla>`

      try {
        const form = new FormData()
        form.append(
          'action-xmlagentxmlfile',
          new Blob([xml], { type: 'text/xml' }),
          'invoice.xml',
        )
        const res = await fetch(endpoint(), { method: 'POST', body: form })
        const text = await res.text()
        if (!res.ok) {
          return { ok: false, error: `Számlázz.hu HTTP ${res.status}` }
        }
        // Agent returns plain text / XML with invoice number on success.
        const match = text.match(/<szamlaszam>([^<]+)<\/szamlaszam>/i) || text.match(/\d{4}-\d+/)
        const externalId = Array.isArray(match) ? match[1] || match[0] : text.slice(0, 64)
        if (/hibakod|error/i.test(text) && !externalId) {
          return { ok: false, error: text.slice(0, 200) }
        }
        return { ok: true, externalId: String(externalId || payload.invoiceNumber) }
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'Számlázz.hu network error',
        }
      }
    },
    info(): BillingProviderInfo {
      return {
        provider: 'szamlazz',
        label: 'Számlázz.hu',
        ready,
        detail: ready ? `Agent ${endpoint()}` : 'Merchant Számlázz agent key required',
      }
    },
  }
}
